"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Zap } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type RazorpayButtonProps = {
  amountInRupees: number;
  orderId?: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess?: (data: { payment_id: string; order_id: string; signature: string }) => void;
  className?: string;
};

export function RazorpayCheckoutButton({
  amountInRupees,
  orderId,
  name = "LOOPEC",
  description = "Campus Marketplace Payment",
  prefill,
  onSuccess,
  className = "",
}: RazorpayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedPayment, setVerifiedPayment] = useState<string | null>(null);

  const amountInPaise = Math.round(amountInRupees * 100);

  async function loadRazorpayScript(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (window.Razorpay) return true;

    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.error("Failed to load Razorpay SDK");
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Load SDK Script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to load Razorpay payment SDK. Please check your internet connection.");
      }

      // Step 2: Call Backend Create Order Endpoint
      const createRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: orderId ? `rcpt_${orderId.slice(0, 16)}` : `rcpt_${Date.now()}`,
          notes: {
            orderId: orderId || "test_order",
            platform: "LOOPEC",
          },
        }),
      });

      const orderData = await createRes.json();
      if (!createRes.ok || !orderData.order_id) {
        throw new Error(orderData.error || "Failed to initiate Razorpay order");
      }

      const keyId = orderData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      // Step 3: Open Razorpay Standard Checkout Modal
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name,
        description,
        image: "/logo.png",
        order_id: orderData.order_id,
        prefill: {
          name: prefill?.name || "Campus Member",
          email: prefill?.email || "student@nitc.ac.in",
          contact: prefill?.contact || "",
        },
        theme: {
          color: "#49347F",
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            // Step 4: Call Backend Verify Signature Endpoint
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                loopec_order_id: orderId,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || "Payment signature verification failed");
            }

            setVerifiedPayment(response.razorpay_payment_id);
            setLoading(false);

            if (onSuccess) {
              onSuccess({
                payment_id: response.razorpay_payment_id,
                order_id: response.razorpay_order_id,
                signature: response.razorpay_signature,
              });
            } else if (orderId) {
              window.location.href = `/orders/${orderId}?paid=1`;
            }
          } catch (verifyErr: any) {
            setError(verifyErr.message || "Payment verification failed");
            setLoading(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setError(response.error?.description || "Payment failed or was declined.");
        setLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      setError(err.message || "An unexpected payment error occurred");
      setLoading(false);
    }
  }

  if (verifiedPayment) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 border border-emerald-200">
        <CheckCircle2 size={16} className="text-emerald-700" />
        Payment Verified: <code className="font-mono">{verifiedPayment}</code>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-violet-950 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-violet-900 active:scale-[0.99] disabled:pointer-events-none disabled:bg-violet-300 ${className}`}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Connecting to Razorpay...
          </>
        ) : (
          <>
            <Zap size={16} /> Pay ₹{amountInRupees.toLocaleString("en-IN")} with Razorpay
          </>
        )}
      </button>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#847c90]">
        <ShieldCheck size={13} className="text-violet-700" />
        Secured by Razorpay Standard Web Checkout
      </div>
    </div>
  );
}
