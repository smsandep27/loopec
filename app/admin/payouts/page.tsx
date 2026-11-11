import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDollarSign, ExternalLink, QrCode, ShieldCheck, Wallet } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentMember } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { signOut } from "@/app/auth/actions";
import { calculateCommission } from "@/lib/payments/commission";

export const instant = false;

type CompletedOrder = {
  id: string;
  seller_id: string;
  buyer_id: string;
  total_amount: number | string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  full_name: string;
  handle: string;
  phone: string | null;
  upi_id: string | null;
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function AdminPayoutsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AuthShell eyebrow="Admin Payouts" title="Connect Database" description="Configure Supabase to view platform settlements.">
        <Link href="/setup" className="font-semibold text-violet-800">View setup details</Link>
      </AuthShell>
    );
  }

  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role)) {
    return (
      <AuthShell eyebrow="Restricted" title="Admin only" description="Only administrators can manage financial payouts.">
        <Link href="/" className="font-semibold text-violet-800">Return to home</Link>
      </AuthShell>
    );
  }

  // Fetch paid and completed orders
  const { data: orderData } = await member.supabase
    .from("orders")
    .select("id, seller_id, buyer_id, total_amount, status, created_at, updated_at")
    .in("status", ["paid", "ready_for_pickup", "completed"])
    .order("updated_at", { ascending: false });

  const orders = (orderData ?? []) as CompletedOrder[];
  const sellerIds = [...new Set(orders.map((o) => o.seller_id))];

  const { data: profileData } = sellerIds.length
    ? await member.supabase.from("profiles").select("id, full_name, handle, phone, upi_id").in("id", sellerIds)
    : { data: [] };

  const sellers = new Map(((profileData ?? []) as Profile[]).map((p) => [p.id, p]));

  // Calculate platform financial stats
  let totalGrossVolume = 0;
  let totalPlatformCommission = 0;
  let totalSellerPayouts = 0;

  for (const o of orders) {
    const val = Number(o.total_amount);
    const comm = calculateCommission(val, 5);
    totalGrossVolume += val;
    totalPlatformCommission += comm.commissionAmount;
    totalSellerPayouts += comm.sellerNetAmount;
  }

  return (
    <main className="min-h-screen bg-[#f7f6f4] px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/admin" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">
          LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Payouts & Settlements</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-xs font-semibold text-violet-800">Admin Home</Link>
          <form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form>
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-6xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900">
          <ArrowLeft size={14} /> Back to Admin overview
        </Link>

        <div className="mt-5 border-b border-[#e8e5e2] pb-7">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-violet-700">
            <Wallet size={14} /> CiGaRa Group · Platform Treasury
          </p>
          <h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Payouts & 5% Commission Ledger</h1>
          <p className="mt-2 text-sm leading-6 text-[#77717e]">
            Online payments land directly into your Razorpay merchant bank account. Use this settlement hub to verify your 5% revenue and disburse the 95% proceeds to student sellers.
          </p>
        </div>

        {/* Financial Stat Cards */}
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[22px] border border-[#e8e5e2] bg-white p-5 shadow-xs">
            <small className="text-[10px] font-bold uppercase tracking-[.14em] text-[#867e91]">Gross Marketplace Volume</small>
            <b className="mt-2 block font-serif text-3xl tracking-tight text-[#302546]">{currency.format(totalGrossVolume)}</b>
            <p className="mt-1 text-xs text-[#8b8593]">Total buyer payments processed</p>
          </div>
          <div className="rounded-[22px] border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-5 shadow-xs">
            <small className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Your 5% Platform Revenue</small>
            <b className="mt-2 block font-serif text-3xl tracking-tight text-violet-950">{currency.format(totalPlatformCommission)}</b>
            <p className="mt-1 text-xs text-violet-800/80">Retained permanently by CiGaRa Group</p>
          </div>
          <div className="rounded-[22px] border border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-xs">
            <small className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-800">Total Seller Payouts (95%)</small>
            <b className="mt-2 block font-serif text-3xl tracking-tight text-emerald-950">{currency.format(totalSellerPayouts)}</b>
            <p className="mt-1 text-xs text-emerald-800/80">To be settled to student sellers via UPI</p>
          </div>
        </div>

        {/* Payouts Table */}
        <div className="mt-8 rounded-[24px] border border-[#e8e5e2] bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f0edf0] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#302546]">Seller Payout Disbursals</h2>
              <p className="text-xs text-[#787082]">List of orders eligible for seller payout</p>
            </div>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-900">
              {orders.length} orders
            </span>
          </div>

          {!orders.length ? (
            <div className="py-12 text-center text-sm text-[#888190]">
              <p className="font-serif text-xl text-[#383240]">No paid orders pending payout yet.</p>
              <p className="mt-1 text-xs text-[#817a87]">When campus orders are paid online, they will appear here with seller UPI links.</p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#f2eff3]">
              {orders.map((order) => {
                const seller = sellers.get(order.seller_id);
                const comm = calculateCommission(order.total_amount, 5);
                const upiLink = seller?.upi_id
                  ? `upi://pay?pa=${encodeURIComponent(seller.upi_id)}&pn=${encodeURIComponent(seller.full_name)}&am=${comm.sellerNetAmount}&cu=INR&tn=${encodeURIComponent(`LOOPEC Payout Order ${order.id.slice(0, 8)}`)}`
                  : null;

                return (
                  <div className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0" key={order.id}>
                    <div>
                      <div className="flex items-center gap-2">
                        <b className="text-sm font-semibold text-[#302546]">{seller?.full_name ?? "Campus Seller"}</b>
                        <span className="rounded bg-[#f5f3f7] px-2 py-0.5 text-[10px] text-[#6d6677]">@{seller?.handle ?? "member"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${order.status === "completed" ? "bg-emerald-100 text-emerald-900" : "bg-violet-100 text-violet-900"}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#7e7787]">
                        Order #{order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[#888191]">Seller UPI:</span>
                        {seller?.upi_id ? (
                          <code className="rounded bg-violet-50 px-2 py-0.5 font-mono font-semibold text-violet-900">
                            {seller.upi_id}
                          </code>
                        ) : (
                          <span className="text-amber-800">Not provided yet</span>
                        )}
                        {seller?.phone ? (
                          <span className="text-[#888191]">· Phone: {seller.phone}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 text-right">
                      <div>
                        <div className="text-xs text-[#787082]">
                          Gross: <b>{comm.formatted.totalAmount}</b> · 5% Fee: <b className="text-violet-800">{comm.formatted.commissionAmount}</b>
                        </div>
                        <div className="text-base font-bold text-emerald-900">
                          Seller Net: {comm.formatted.sellerNetAmount}
                        </div>
                      </div>

                      {upiLink ? (
                        <a
                          href={upiLink}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-800 active:scale-95"
                        >
                          <Wallet size={13} /> Disburse {comm.formatted.sellerNetAmount} via UPI
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#938b99]">
                          Waiting for seller to enter UPI ID in Profile
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
