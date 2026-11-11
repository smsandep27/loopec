import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getRazorpayCredentials, confirmOrderPaymentInDb } from "@/lib/payments/service";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { keySecret, isConfigured } = getRazorpayCredentials();

    if (!isConfigured || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay credentials are not configured on the server" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id || body.razorpay_order_id;
    const paymentId = body.payment_id || body.razorpay_payment_id;
    const razorpaySignature = body.razorpay_signature || body.signature;
    const loopecOrderId = body.loopec_order_id || body.orderId;

    // Validate required fields
    if (!orderId || !paymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: "Missing required fields: order_id, payment_id, and razorpay_signature are required" },
        { status: 400 }
      );
    }

    // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf-8");
    const receivedBuf = Buffer.from(String(razorpaySignature), "utf-8");

    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return NextResponse.json(
        { success: false, error: "Invalid payment signature. Verification failed." },
        { status: 400 }
      );
    }

    // Signatures match! If attached to a marketplace order, confirm in DB
    if (loopecOrderId) {
      try {
        const supabase = await createClient();
        await confirmOrderPaymentInDb(supabase, {
          orderId: loopecOrderId,
          provider: "razorpay",
          paymentId: paymentId,
          orderReference: orderId,
          signature: razorpaySignature,
        });
      } catch (dbErr) {
        console.warn("Database confirmation note:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      payment_id: paymentId,
      order_id: orderId,
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during verification" },
      { status: 500 }
    );
  }
}
