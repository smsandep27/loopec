"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireApprovedMember } from "@/lib/auth/member";
import {
  createPaymentSession,
  verifyRazorpaySignature,
  confirmOrderPaymentInDb,
  type PaymentSessionResult,
} from "@/lib/payments/service";

const paymentPayloadSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.enum(["razorpay", "sandbox", "manual_upi"]),
  paymentId: z.string().min(5).max(100),
  orderReference: z.string().max(100).optional(),
  signature: z.string().max(256).optional(),
});

/**
 * Initiates an online payment session (Razorpay or Campus Sandbox).
 */
export async function initiateOrderPaymentSession(
  orderId: string
): Promise<{ ok: boolean; session?: PaymentSessionResult; error?: string }> {
  try {
    const { supabase, userId, profile } = await requireApprovedMember();

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, buyer_id, total_amount, currency, status")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      return { ok: false, error: "Order was not found" };
    }

    if (order.buyer_id !== userId && process.env.LOOPEC_DEV_BYPASS_AUTH !== "true") {
      return { ok: false, error: "Only the buyer can pay for this order" };
    }

    if (!["accepted", "payment_pending"].includes(order.status)) {
      return { ok: false, error: `Order is not awaiting payment (status: ${order.status})` };
    }

    const session = await createPaymentSession({
      orderId: order.id,
      amount: Number(order.total_amount),
      currency: order.currency || "INR",
      customerName: profile?.full_name,
    });

    return { ok: true, session };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to initiate payment session" };
  }
}

/**
 * Verifies and completes the online payment.
 */
export async function completeOrderPayment(formData: FormData) {
  const parsed = paymentPayloadSchema.safeParse({
    orderId: formData.get("order_id"),
    provider: formData.get("provider"),
    paymentId: formData.get("payment_id"),
    orderReference: formData.get("order_reference") || undefined,
    signature: formData.get("signature") || undefined,
  });

  if (!parsed.success) {
    redirect("/orders?error=payment_payload");
  }

  const { orderId, provider, paymentId, orderReference, signature } = parsed.data;
  const { supabase, userId } = await requireApprovedMember();

  // If Razorpay, cryptographically verify the signature
  if (provider === "razorpay") {
    if (!orderReference || !signature) {
      redirect(`/orders/${orderId}?error=payment_signature_missing`);
    }

    const isValid = verifyRazorpaySignature({
      razorpayOrderId: orderReference,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    });

    if (!isValid) {
      redirect(`/orders/${orderId}?error=invalid_signature`);
    }
  }

  const result = await confirmOrderPaymentInDb(supabase, {
    orderId,
    provider,
    paymentId,
    orderReference,
    signature,
  });

  if (!result.success) {
    redirect(`/orders/${orderId}?error=payment_confirm_failed`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  redirect(`/orders/${orderId}?paid=1`);
}
