"use client";

import { useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Clock3,
  QrCode,
  ArrowRight,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyCampusHandover } from "@/app/orders/actions";

type CampusHandoverCardProps = {
  orderId: string;
  buyerView: boolean;
  status: string;
  handoverPin: string;
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  sellerName?: string;
  buyerName?: string;
  pickupLocationName?: string;
};

export function CampusHandoverCard({
  orderId,
  buyerView,
  status,
  handoverPin,
  buyerConfirmedAt,
  sellerConfirmedAt,
  sellerName = "Seller",
  buyerName = "Buyer",
  pickupLocationName = "Designated Campus Pickup Zone",
}: CampusHandoverCardProps) {
  const [pinInput, setPinInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const isCompleted = status === "completed";
  const isReady = status === "ready_for_pickup";

  const handleCopyPin = () => {
    navigator.clipboard.writeText(handoverPin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isCompleted) {
    return (
      <article className="rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Handover Verified
            </span>
            <h2 className="font-serif text-xl font-bold text-emerald-950 sm:text-2xl">
              Campus Handover Completed
            </h2>
            <p className="text-xs leading-relaxed text-emerald-900/80 sm:text-sm">
              Both parties completed physical verification on campus. 95% net seller payout has been released, and 5% platform commission is booked.
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-emerald-200/60 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            Verified Handover at {pickupLocationName}
          </span>
          <span className="font-mono text-emerald-800">
            Order ID: {orderId.slice(0, 8)}...
          </span>
        </div>
      </article>
    );
  }

  if (!isReady) {
    return null;
  }

  return (
    <article className="rounded-[26px] border border-violet-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-violet-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white shadow-sm">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-violet-950 sm:text-xl">
              Campus Delivery Handover Protection
            </h2>
            <p className="text-xs text-gray-500">
              Meeting point: <strong className="text-violet-900">{pickupLocationName}</strong>
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 border border-violet-200">
          <ShieldCheck className="h-3.5 w-3.5 text-violet-600" />
          Zero-Fraud Escrow
        </span>
      </div>

      <div className="mt-6">
        {buyerView ? (
          /* BUYER VIEW: SHOW 4-DIGIT PIN & QR */
          <div className="space-y-6">
            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
                Your 4-Digit Handover PIN
              </p>

              {/* Big 4-digit PIN Boxes */}
              <div className="mt-3 flex items-center justify-center gap-3">
                {handoverPin.split("").map((digit, i) => (
                  <div
                    key={i}
                    className="flex h-14 w-12 sm:h-16 sm:w-14 items-center justify-center rounded-2xl border-2 border-violet-400 bg-white font-mono text-3xl font-extrabold text-violet-950 shadow-sm"
                  >
                    {digit}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-medium text-violet-800 shadow-xs hover:bg-violet-50 transition"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? "PIN Copied!" : "Copy PIN"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-medium text-violet-800 shadow-xs hover:bg-violet-50 transition"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{showQr ? "Hide QR" : "Show Handover QR"}</span>
                </button>
              </div>

              {showQr && (
                <div className="mt-4 p-4 bg-white rounded-xl border border-violet-200 inline-block shadow-sm">
                  <div className="grid place-items-center h-40 w-40 bg-violet-950 rounded-lg text-white text-center p-2 font-mono text-xs">
                    <QrCode className="h-20 w-20 text-white mb-1" />
                    <span>PIN: {handoverPin}</span>
                    <span className="text-[9px] text-violet-300">LOOPEC Handover</span>
                  </div>
                </div>
              )}
            </div>

            {/* Buyer Instructions */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 leading-relaxed space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
                Important Buyer Safety Rule:
              </p>
              <p>
                Meet <strong>{sellerName}</strong> at <strong>{pickupLocationName}</strong>. Inspect the item thoroughly (check books, electronic devices, or condition). Give this 4-digit PIN to the seller <strong>ONLY AFTER</strong> you physically verify the item.
              </p>
            </div>
          </div>
        ) : (
          /* SELLER VIEW: ENTER BUYER'S 4-DIGIT PIN TO COMPLETE */
          <div className="space-y-6">
            <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-800">
                Enter Buyer&apos;s Handover PIN
              </p>
              <p className="mt-1 text-xs text-gray-600">
                Ask <strong>{buyerName}</strong> for their 4-digit PIN once they have inspected and accepted the item.
              </p>

              <form action={verifyCampusHandover} className="mt-4 space-y-4">
                <input type="hidden" name="order_id" value={orderId} />

                <div className="flex items-center gap-3">
                  <input
                    name="handover_pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    pattern="[0-9]{4}"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="4-digit PIN"
                    className="h-14 w-48 rounded-2xl border-2 border-violet-300 bg-white px-4 text-center font-mono text-2xl font-bold tracking-widest text-violet-950 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100 shadow-sm"
                    required
                  />

                  <Button
                    type="submit"
                    size="lg"
                    disabled={pinInput.length !== 4}
                    className="flex-1 font-semibold"
                  >
                    <span>Verify PIN & Complete Handover</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600 leading-relaxed">
              💡 <strong>Instant Payout Release:</strong> Once you enter the correct 4-digit PIN, this order completes immediately and your 95% net payout is confirmed.
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
