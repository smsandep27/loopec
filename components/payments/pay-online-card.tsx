"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Landmark, Loader2, QrCode, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { initiateOrderPaymentSession, completeOrderPayment } from "@/app/orders/payment-actions";
import { calculateCommission, inrFormatter } from "@/lib/payments/commission";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type PayOnlineCardProps = {
  orderId: string;
  amount: number;
  currency?: string;
  buyerName?: string;
};

export function PayOnlineCard({ orderId, amount, currency = "INR", buyerName = "Campus Member" }: PayOnlineCardProps) {
  const [loading, setLoading] = useState(false);
  const [showSandboxModal, setShowSandboxModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const breakdown = calculateCommission(amount, 5);

  async function handleStartPayment() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await initiateOrderPaymentSession(orderId);
      if (!res.ok || !res.session) {
        setErrorMessage(res.error || "Could not start payment session");
        setLoading(false);
        return;
      }

      const session = res.session;

      if (session.mode === "razorpay" && session.keyId && session.razorpayOrderId) {
        // Load Razorpay checkout script if needed
        if (!window.Razorpay) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
            document.body.appendChild(script);
          });
        }

        const options = {
          key: session.keyId,
          amount: Math.round(session.amount * 100),
          currency: session.currency,
          name: "LOOPEC",
          description: `Campus Order ${orderId.slice(0, 8)}`,
          image: "/logo.png",
          order_id: session.razorpayOrderId,
          handler: function (response: any) {
            const form = document.createElement("form");
            form.method = "POST";
            form.action = completeOrderPayment as unknown as string;

            const fields: Record<string, string> = {
              order_id: orderId,
              provider: "razorpay",
              payment_id: response.razorpay_payment_id,
              order_reference: response.razorpay_order_id,
              signature: response.razorpay_signature,
            };

            for (const [k, v] of Object.entries(fields)) {
              const input = document.createElement("input");
              input.type = "hidden";
              input.name = k;
              input.value = v;
              form.appendChild(input);
            }

            document.body.appendChild(form);
            form.requestSubmit();
          },
          prefill: {
            name: buyerName,
          },
          theme: {
            color: "#49347F",
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
          setErrorMessage(response.error?.description || "Payment failed or was cancelled.");
          setLoading(false);
        });
        rzp.open();
        setLoading(false);
      } else {
        // Campus Sandbox mode
        setShowSandboxModal(true);
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while opening payment.");
      setLoading(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-[24px] border border-violet-200 bg-gradient-to-br from-white to-violet-50/40 p-5 shadow-[0_18px_60px_-40px_rgba(73,52,127,.25)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white shadow-sm">
            <Zap size={18} />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#302546]">Online Campus Payment</h2>
            <p className="text-xs text-[#71687d]">Instant UPI · Cards · NetBanking</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-semibold text-violet-900">
          <ShieldCheck size={13} /> Secured 5% Commission
        </span>
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
          {errorMessage}
        </p>
      )}

      {/* 5% Platform Fee Transparency Breakdown */}
      <div className="mt-5 rounded-2xl border border-violet-100 bg-white/80 p-4 backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Financial Breakdown</p>
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between text-[#686071]">
            <span>Item Subtotal</span>
            <b className="font-semibold text-[#302546]">{breakdown.formatted.subtotal}</b>
          </div>
          <div className="flex justify-between text-[#686071]">
            <span className="inline-flex items-center gap-1">
              CiGaRa / LOOPEC Fee ({breakdown.commissionPercent}%)
              <span className="rounded bg-violet-50 px-1 py-0.5 text-[9px] font-bold text-violet-700">Platform</span>
            </span>
            <b className="font-semibold text-violet-900">{breakdown.formatted.commissionAmount}</b>
          </div>
          <div className="flex justify-between text-[#686071]">
            <span>Seller Net Payout (95%)</span>
            <span className="font-medium text-[#493e54]">{breakdown.formatted.sellerNetAmount}</span>
          </div>
          <div className="border-t border-[#ede9f2] pt-2 flex justify-between text-sm">
            <span className="font-semibold text-[#302546]">Total Amount Payable</span>
            <b className="font-bold text-violet-950">{breakdown.formatted.totalAmount}</b>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <button
          onClick={handleStartPayment}
          disabled={loading}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-violet-950 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-violet-900 active:scale-[0.99] disabled:pointer-events-none disabled:bg-violet-300"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Preparing payment...
            </>
          ) : (
            <>
              <Zap size={16} /> Pay {breakdown.formatted.totalAmount} Online
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[11px] text-[#867e91]">
          Funds remain protected until both buyer and seller confirm campus pickup handover.
        </p>
      </div>

      {/* Campus Sandbox Simulation Modal */}
      {showSandboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-[26px] border border-[#e8e5ec] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-900">
                  <Sparkles size={11} /> Campus Online Gateway
                </span>
                <h3 className="mt-2 font-serif text-2xl text-[#2b2438]">Choose Payment Method</h3>
              </div>
              <button
                onClick={() => setShowSandboxModal(false)}
                className="grid size-8 place-items-center rounded-full text-[#7a7385] hover:bg-[#f0edf3]"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod("upi")}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold transition ${
                  selectedMethod === "upi"
                    ? "border-violet-600 bg-violet-50 text-violet-950"
                    : "border-[#e5e1eb] bg-white text-[#686072] hover:bg-[#fbfafc]"
                }`}
              >
                <QrCode size={20} className={selectedMethod === "upi" ? "text-violet-700" : "text-[#7a7385]"} />
                Instant UPI
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod("card")}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold transition ${
                  selectedMethod === "card"
                    ? "border-violet-600 bg-violet-50 text-violet-950"
                    : "border-[#e5e1eb] bg-white text-[#686072] hover:bg-[#fbfafc]"
                }`}
              >
                <CreditCard size={20} className={selectedMethod === "card" ? "text-violet-700" : "text-[#7a7385]"} />
                Debit / Card
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod("netbanking")}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold transition ${
                  selectedMethod === "netbanking"
                    ? "border-violet-600 bg-violet-50 text-violet-950"
                    : "border-[#e5e1eb] bg-white text-[#686072] hover:bg-[#fbfafc]"
                }`}
              >
                <Landmark size={20} className={selectedMethod === "netbanking" ? "text-violet-700" : "text-[#7a7385]"} />
                NetBanking
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-[#f7f5fa] p-4 text-xs">
              {selectedMethod === "upi" && (
                <div className="space-y-1.5 text-[#5e5668]">
                  <p className="font-semibold text-[#2f273b]">⚡ Instant UPI Transfer</p>
                  <p>Compatible with Google Pay, PhonePe, Paytm, BHIM, and campus UPI IDs.</p>
                  <small className="block text-violet-700">Payer: {buyerName} · NIT Calicut</small>
                </div>
              )}
              {selectedMethod === "card" && (
                <div className="space-y-1.5 text-[#5e5668]">
                  <p className="font-semibold text-[#2f273b]">💳 RuPay / Visa / Mastercard</p>
                  <p>Student campus debit cards and all major Indian bank credit cards accepted.</p>
                </div>
              )}
              {selectedMethod === "netbanking" && (
                <div className="space-y-1.5 text-[#5e5668]">
                  <p className="font-semibold text-[#2f273b]">🏦 Campus Bank Branch NetBanking</p>
                  <p>State Bank of India (SBI NITC Branch), Canara Bank, HDFC, ICICI supported.</p>
                </div>
              )}
            </div>

            <form action={completeOrderPayment} className="mt-5">
              <input type="hidden" name="order_id" value={orderId} />
              <input type="hidden" name="provider" value="sandbox" />
              <input
                type="hidden"
                name="payment_id"
                value={`PAY-${selectedMethod.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`}
              />
              <input
                type="hidden"
                name="order_reference"
                value={`REF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`}
              />
              <button
                type="submit"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-violet-950 px-5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-900"
              >
                <CheckCircle2 size={16} /> Confirm & Pay {breakdown.formatted.totalAmount}
              </button>
            </form>
          </div>
        </div>
      )}
    </article>
  );
}

export function PaymentReceiptCard({
  orderId,
  amount,
  paymentMethod = "Online",
  referenceId,
  verifiedAt,
}: {
  orderId: string;
  amount: number;
  paymentMethod?: string;
  referenceId?: string | null;
  verifiedAt?: string | null;
}) {
  const breakdown = calculateCommission(amount, 5);

  return (
    <article className="rounded-[24px] border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <h2 className="text-base font-bold text-emerald-950">Payment Verified & Protected</h2>
            <p className="text-xs text-emerald-800">
              {verifiedAt ? new Date(verifiedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Verified"}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-900">
          PAID · {paymentMethod}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/90 p-4 text-xs">
        {referenceId && (
          <div className="mb-3 flex justify-between border-b border-[#eee] pb-2 text-[#686072]">
            <span>Transaction Reference</span>
            <code className="font-mono font-semibold text-[#2f273b]">{referenceId}</code>
          </div>
        )}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[#686072]">
            <span>Gross Amount</span>
            <b className="text-[#2f273b]">{breakdown.formatted.totalAmount}</b>
          </div>
          <div className="flex justify-between text-[#686072]">
            <span>LOOPEC Platform Commission (5%)</span>
            <b className="text-violet-900">{breakdown.formatted.commissionAmount}</b>
          </div>
          <div className="flex justify-between text-[#686072]">
            <span>Seller Net Payout (95%)</span>
            <b className="text-emerald-900">{breakdown.formatted.sellerNetAmount}</b>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-emerald-900">
        The payment is held in escrow. Payout to seller will be disbursed once both participants confirm the campus pickup handover.
      </p>
    </article>
  );
}
