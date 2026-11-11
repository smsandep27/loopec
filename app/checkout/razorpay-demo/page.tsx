import Link from "next/link";
import { ArrowLeft, CreditCard, ShieldCheck } from "lucide-react";
import { RazorpayCheckoutButton } from "@/components/payments/razorpay-button";

export const instant = false;

export default async function RazorpayDemoPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f4] px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-[#e8e5e2] pb-6">
        <Link href="/" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">
          LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Razorpay Checkout</span>
        </Link>
        <Link href="/marketplace" className="text-xs font-semibold text-violet-800">
          Marketplace
        </Link>
      </header>

      <section className="mx-auto mt-10 max-w-xl">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900">
          <ArrowLeft size={14} /> Back to home
        </Link>

        <div className="mt-5 rounded-[28px] border border-[#e8e5ec] bg-white p-6 shadow-[0_20px_70px_-40px_rgba(73,52,127,.25)] sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <CreditCard size={22} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-violet-700">Official Integration</p>
              <h1 className="font-serif text-2xl text-[#2b2438]">Razorpay Standard Web Checkout</h1>
            </div>
          </div>

          <p className="mt-4 text-xs leading-6 text-[#726a7e]">
            This page demonstrates the 3-step Razorpay Standard Web Checkout flow using your configured Test Credentials (<code>rzp_test_TyreyjCIz9Wdr2</code>):
          </p>

          <ol className="mt-4 list-decimal space-y-2 pl-4 text-xs text-[#5e5668]">
            <li><b>Backend Create Order:</b> <code>POST /api/create-order</code> calls Razorpay API to generate an authenticated <code>order_id</code>.</li>
            <li><b>Frontend Modal:</b> Loads <code>checkout.js</code> and displays the Razorpay UPI & Cards payment popup.</li>
            <li><b>Backend Verify Signature:</b> <code>POST /api/verify-payment</code> verifies the cryptographic <code>HMAC-SHA256</code> signature with <code>RAZORPAY_KEY_SECRET</code>.</li>
          </ol>

          {/* Test Checkout Box */}
          <div className="mt-6 rounded-2xl border border-violet-100 bg-[#f9f8fc] p-5">
            <div className="flex justify-between text-xs text-[#6a6275]">
              <span>Sample Item</span>
              <b className="text-[#2b2438]">Campus Study Notes</b>
            </div>
            <div className="mt-2 flex justify-between text-xs text-[#6a6275]">
              <span>Currency</span>
              <b className="text-[#2b2438]">INR (₹)</b>
            </div>
            <div className="mt-2 flex justify-between text-xs text-[#6a6275]">
              <span>Test Amount</span>
              <b className="text-base font-bold text-violet-950">₹100.00</b>
            </div>
            <div className="mt-5">
              <RazorpayCheckoutButton
                amountInRupees={100}
                name="LOOPEC Test Order"
                description="Sample Campus Payment Verification"
                prefill={{
                  name: "NITC Student",
                  email: "student@nitc.ac.in",
                  contact: "9876543210",
                }}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-xl bg-violet-50 p-3.5 text-xs text-violet-950">
            <ShieldCheck size={18} className="shrink-0 text-violet-700" />
            <span>
              In Razorpay Test mode, you can use any UPI ID (e.g. <code>success@razorpay</code>) or test cards to complete payments with 0 cost.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
