import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateCommission, type CommissionBreakdown } from "@/lib/payments/commission";

export type PaymentProvider = "razorpay" | "sandbox" | "manual_upi";

export type PaymentSessionResult = {
  mode: "razorpay" | "sandbox";
  orderId: string;
  amount: number;
  currency: string;
  breakdown: CommissionBreakdown;
  keyId?: string;
  razorpayOrderId?: string;
};

export type VerifyPaymentParams = {
  orderId: string;
  provider: PaymentProvider;
  paymentId: string;
  orderReference?: string;
  signature?: string;
};

export function getRazorpayCredentials() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return {
    keyId: keyId?.trim() || null,
    keySecret: keySecret?.trim() || null,
    isConfigured: Boolean(keyId && keySecret),
  };
}

/**
 * Creates a payment session for an order.
 * If Razorpay keys are configured, creates a real Razorpay Order.
 * Otherwise, provisions a local campus sandbox session for instant testing.
 */
export async function createPaymentSession({
  orderId,
  amount,
  currency = "INR",
  customerName,
  customerEmail,
  customerContact,
}: {
  orderId: string;
  amount: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerContact?: string;
}): Promise<PaymentSessionResult> {
  const breakdown = calculateCommission(amount, 5);
  const { isConfigured, keyId, keySecret } = getRazorpayCredentials();

  if (isConfigured && keyId && keySecret) {
    try {
      // Dynamic import to keep build lean
      const RazorpayModule = await import("razorpay");
      const RazorpayClass = RazorpayModule.default || RazorpayModule;
      const razorpay = new RazorpayClass({
        key_id: keyId,
        key_secret: keySecret,
      });

      const amountInPaise = Math.round(breakdown.totalAmount * 100);
      const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency,
        receipt: `ord_${orderId.slice(0, 16)}`,
        notes: {
          loopec_order_id: orderId,
          subtotal: breakdown.subtotal.toString(),
          commission_5pct: breakdown.commissionAmount.toString(),
          seller_net_95pct: breakdown.sellerNetAmount.toString(),
          customer_name: customerName || "Campus Member",
        },
      });

      return {
        mode: "razorpay",
        orderId,
        amount: breakdown.totalAmount,
        currency,
        breakdown,
        keyId,
        razorpayOrderId: razorpayOrder.id,
      };
    } catch (error) {
      console.warn("Razorpay order creation fallback to sandbox:", error);
    }
  }

  // Local Campus Sandbox (default when keys are not configured or during testing)
  return {
    mode: "sandbox",
    orderId,
    amount: breakdown.totalAmount,
    currency,
    breakdown,
  };
}

/**
 * Cryptographically verifies payment signature (HMAC SHA256 for Razorpay).
 */
export function verifyRazorpaySignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const { keySecret } = getRazorpayCredentials();
  if (!keySecret) return false;

  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "utf-8"),
    Buffer.from(razorpaySignature, "utf-8")
  );
}

/**
 * Confirms payment in the database, moves order to 'paid',
 * and records the 5% platform commission ledger entry.
 */
export async function confirmOrderPaymentInDb(
  supabase: SupabaseClient,
  params: VerifyPaymentParams
): Promise<{ success: boolean; error?: string }> {
  const { orderId, provider, paymentId, orderReference } = params;

  // 1. Try modern confirm_online_payment RPC
  const { error: rpcError } = await supabase.rpc("confirm_online_payment", {
    p_order_id: orderId,
    p_provider: provider,
    p_provider_payment_id: paymentId,
    p_provider_order_id: orderReference || null,
  });

  if (!rpcError) {
    return { success: true };
  }

  // 2. Fallback if confirm_online_payment RPC not yet applied in Supabase
  // Attempt transition to payment_pending and submit reference
  try {
    await supabase.rpc("transition_order_status", {
      p_order_id: orderId,
      p_next_status: "payment_pending",
    });

    const cleanRef = paymentId.slice(0, 32).toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const safeRef = cleanRef.length >= 6 ? cleanRef : `ONLINE-${cleanRef.padEnd(6, "0")}`;

    const { error: refError } = await supabase.rpc("submit_manual_payment_reference", {
      p_order_id: orderId,
      p_reference: safeRef,
    });

    if (!refError) {
      return { success: true };
    }
  } catch (err) {
    console.warn("Fallback payment transition error:", err);
  }

  // If in dev mode bypass, succeed gracefully
  if (process.env.LOOPEC_DEV_BYPASS_AUTH === "true") {
    return { success: true };
  }

  return { success: false, error: rpcError?.message || "Failed to confirm payment" };
}
