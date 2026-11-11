import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getRazorpayCredentials } from "@/lib/payments/service";

export async function POST(req: Request) {
  try {
    const { keyId, keySecret, isConfigured } = getRazorpayCredentials();

    if (!isConfigured || !keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay credentials are not configured on the server" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    let amount = Number(body.amount);
    const currency = (body.currency || "INR").toUpperCase();
    const receipt = body.receipt || `rcpt_${Date.now().toString(36)}`;
    const notes = body.notes || {};

    // Validate amount
    if (isNaN(amount) || amount < 100) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum amount is 100 paise (₹1.00)" },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Call Razorpay API: POST https://api.razorpay.com/v1/orders
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount),
      currency,
      receipt: String(receipt).slice(0, 40),
      notes,
    });

    return NextResponse.json({
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: keyId,
    });
  } catch (error: any) {
    console.error("Razorpay create-order error:", error);
    return NextResponse.json(
      {
        error: error?.error?.description || error?.message || "Failed to create Razorpay order",
      },
      { status: 500 }
    );
  }
}
