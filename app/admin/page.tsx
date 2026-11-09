import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CircleDollarSign, FileText, ShieldCheck, UsersRound } from "lucide-react";
import { AuthShell, FormNotice } from "@/components/auth/auth-shell";
import { authMessage } from "@/lib/auth/messages";
import { getCurrentMember } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { reviewVerification } from "@/app/admin/actions";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type VerificationRequest = {
  id: string;
  user_id: string;
  college_id: string;
  requested_role: "student" | "faculty" | "staff";
  college_email: string;
  id_document_path: string;
  created_at: string;
};
type Transaction = { id: string; order_id: string; transaction_type: string; gross_amount: number | string; seller_net_amount: number | string; created_at: string };

function formatRole(role: VerificationRequest["requested_role"]) {
  return role === "staff" ? "College staff" : role[0].toUpperCase() + role.slice(1);
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const { error, reviewed } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  if (!isSupabaseConfigured()) {
    return <AuthShell eyebrow="College administration" title="Pilot setup is incomplete" description="Admin review will be available once the pilot Supabase project is connected."><Link className="font-semibold text-violet-800" href="/setup">View setup details</Link></AuthShell>;
  }

  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role) || member.profile.suspended_at) {
    return <AuthShell eyebrow="Restricted area" title="College administrators only" description="Your signed-in account does not have access to the LOOPEC admin panel."><Link className="font-semibold text-violet-800" href="/">Return to home</Link></AuthShell>;
  }

  let queueQuery = member.supabase
    .from("user_verifications")
    .select("id, user_id, college_id, requested_role, college_email, id_document_path, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (member.profile.role !== "super_admin" && member.profile.college_id) {
    queueQuery = queueQuery.eq("college_id", member.profile.college_id);
  }
  const { data: queueData, error: queueError } = await queueQuery;
  const queue = (queueData ?? []) as VerificationRequest[];
  const userIds = [...new Set(queue.map((row) => row.user_id))];
  const { data: profiles } = userIds.length
    ? await member.supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id as string, profile.full_name as string]));
  const links = await Promise.all(queue.map(async (item) => {
    const { data } = await member.supabase.storage
      .from("verification-documents")
      .createSignedUrl(item.id_document_path, 90);
    return [item.id, data?.signedUrl ?? null] as const;
  }));
  const documentUrls = new Map(links);
  const [memberCountResult, listingCountResult, orderCountResult, reportCountResult, transactionResult] = await Promise.all([
    member.supabase.from("profiles").select("id", { count: "exact", head: true }),
    member.supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "approved"),
    member.supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "accepted", "payment_pending", "paid", "ready_for_pickup"]),
    member.supabase.from("reports").select("id", { count: "exact", head: true }).in("status", ["open", "under_review"]),
    member.supabase.from("transactions").select("id, order_id, transaction_type, gross_amount, seller_net_amount, created_at").in("transaction_type", ["payment", "refund"]).order("created_at", { ascending: false }).limit(8),
  ]);
  const transactions = (transactionResult.data ?? []) as Transaction[];
  const transactionOrderIds = [...new Set(transactions.map((transaction) => transaction.order_id))];
  const transactionOrderQuery = transactionOrderIds.length
    ? await member.supabase.from("orders").select("id, buyer_id, seller_id").in("id", transactionOrderIds)
    : { data: [] };
  const transactionProfileIds = [...new Set((transactionOrderQuery.data ?? []).flatMap((order) => [order.buyer_id, order.seller_id]))];
  const transactionProfilesQuery = transactionProfileIds.length
    ? await member.supabase.from("profiles").select("id, full_name").in("id", transactionProfileIds)
    : { data: [] };
  const transactionOrders = new Map(((transactionOrderQuery.data ?? []) as { id: string; buyer_id: string; seller_id: string }[]).map((order) => [order.id, order]));
  const transactionProfiles = new Map(((transactionProfilesQuery.data ?? []) as { id: string; full_name: string }[]).map((profile) => [profile.id, profile.full_name]));

  return (
    <main className="min-h-screen bg-[#f7f6f4] px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="font-normal tracking-normal text-[#8b8590]">Admin</span></Link>
        <div className="flex items-center gap-3">
          <Link href="/admin/listings" className="rounded-full border border-[#e4e0e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#514a5b] hover:border-violet-300">Listing moderation</Link>
          <Link href="/admin/orders" className="rounded-full border border-[#e4e0e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#514a5b] hover:border-violet-300">Order review</Link>
          <Link href="/admin/members" className="rounded-full border border-[#e4e0e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#514a5b] hover:border-violet-300">Member access</Link>
          <Link href="/admin/pickup" className="rounded-full border border-[#e4e0e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#514a5b] hover:border-violet-300">Pickup points</Link>
          <Link href="/admin/reports" className="rounded-full border border-[#e4e0e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#514a5b] hover:border-violet-300">Reports</Link>
          {member.profile.role === "super_admin" ? <Link href="/admin/settings" className="rounded-full border border-[#e4e0e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#514a5b] hover:border-violet-300">Platform settings</Link> : null}
          <span className="hidden text-sm text-[#756f7b] sm:block">{member.profile.full_name}</span>
          <form action={signOut}><button className="rounded-full border border-[#e4e0e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#514a5b] hover:border-violet-300" type="submit">Sign out</button></form>
        </div>
      </header>
      <section className="mx-auto mt-12 max-w-6xl">
        <div className="flex flex-col gap-7 border-b border-[#e8e5e2] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-violet-700"><ShieldCheck size={15} /> College operations</p>
            <h1 className="mt-3 font-serif text-4xl tracking-[-.05em] text-[#28232f] sm:text-5xl">Member verification</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#77717e]">Review campus ID documents and approve access for the college community.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#e8e3ec] bg-white px-4 py-3">
            <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-800"><UsersRound size={19} /></span>
            <span><b className="block text-lg text-[#28232f]">{queue.length}</b><small className="text-xs text-[#77717e]">pending review</small></span>
          </div>
        </div>

        <div className="mt-7 space-y-4">
          {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}
          {reviewed ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Verification decision saved.</p> : null}
          {queueError ? <FormNotice>We could not load the verification queue. Check that the migration is applied and your admin account is scoped to this college.</FormNotice> : null}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="College marketplace overview">
            {[
              { label: "Community members", value: memberCountResult.count ?? 0 },
              { label: "Live listings", value: listingCountResult.count ?? 0 },
              { label: "Open orders", value: orderCountResult.count ?? 0 },
              { label: "Open reports", value: reportCountResult.count ?? 0 },
            ].map((metric) => <div className="rounded-[20px] border border-[#e8e5e2] bg-white p-4" key={metric.label}><small className="text-[10px] font-bold uppercase tracking-[.12em] text-[#89828e]">{metric.label}</small><b className="mt-2 block font-serif text-3xl tracking-tight text-[#302546]">{metric.value}</b></div>)}
          </section>
          <section className="rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-violet-700"><CircleDollarSign size={14} /> Transactions</p><h2 className="mt-1 text-lg font-semibold text-[#302b37]">Recent payment activity</h2></div><Link className="text-xs font-semibold text-violet-800 hover:text-violet-950" href="/admin/orders">Payment review</Link></div>
            {transactions.length ? <div className="mt-4 divide-y divide-[#f0edf0]">{transactions.map((transaction) => {
              const order = transactionOrders.get(transaction.order_id);
              const buyerName = order ? transactionProfiles.get(order.buyer_id) : null;
              const sellerName = order ? transactionProfiles.get(order.seller_id) : null;
              return <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0" key={transaction.id}><span><b className="block text-sm text-[#393341]">{transaction.transaction_type === "refund" ? "Refund recorded" : "Payment verified"}</b><small className="mt-1 block text-xs text-[#8b8590]">Order {transaction.order_id.slice(0, 8)} · {buyerName ?? "Buyer"} → {sellerName ?? "Seller"} · {new Date(transaction.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</small></span><span className="text-right"><b className="block text-sm text-[#393341]">₹{Number(transaction.gross_amount).toLocaleString("en-IN")}</b><small className="text-xs text-[#8b8590]">Seller net ₹{Number(transaction.seller_net_amount).toLocaleString("en-IN")}</small></span></div>;
            })}</div> : <p className="mt-4 rounded-xl bg-[#faf9fa] px-4 py-5 text-sm text-[#77717e]">Verified payments and refunds will appear here.</p>}
          </section>
          {!queueError && queue.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#d9d2e0] bg-white px-6 py-14 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6f3fa] text-violet-800"><BadgeCheck size={22} /></span>
              <h2 className="mt-4 font-serif text-2xl text-[#28232f]">You’re all caught up</h2>
              <p className="mt-2 text-sm text-[#77717e]">New member submissions will appear here.</p>
            </div>
          ) : null}
          {queue.map((item) => (
            <article className="grid gap-5 rounded-3xl border border-[#e8e5e2] bg-white p-5 shadow-[0_12px_45px_-38px_rgba(43,29,68,.45)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6" key={item.id}>
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="text-lg font-semibold text-[#28232f]">{names.get(item.user_id) ?? "Campus member"}</h2>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-800">{formatRole(item.requested_role)}</span>
                </div>
                <p className="mt-1 text-sm text-[#77717e]">{item.college_email}</p>
                <p className="mt-2 text-xs text-[#928b96]">Submitted {new Date(item.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
                {documentUrls.get(item.id) ? (
                  <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-800 hover:text-violet-950" href={documentUrls.get(item.id)!} target="_blank" rel="noreferrer">
                    <FileText size={16} /> Open private ID document <ArrowUpRight size={14} />
                  </a>
                ) : <p className="mt-4 text-xs font-medium text-rose-700">Document link unavailable. Check Storage policies.</p>}
              </div>
              <div className="flex flex-wrap gap-2 sm:max-w-[360px]">
                <form action={reviewVerification} className="flex flex-wrap gap-2 sm:justify-end">
                  <input type="hidden" name="verification_id" value={item.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button className="min-h-11 rounded-full bg-violet-950 px-4 text-sm font-semibold text-white transition hover:bg-violet-900" type="submit">Approve member</button>
                </form>
                <form action={reviewVerification} className="flex w-full flex-col gap-2 sm:items-end">
                  <input type="hidden" name="verification_id" value={item.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <label className="w-full text-left text-xs font-semibold text-[#68616f]">Reason for rejection
                    <textarea className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-[#e4e0e8] p-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="rejection_reason" minLength={5} maxLength={1000} required />
                  </label>
                  <button className="min-h-10 rounded-full border border-rose-200 px-4 text-sm font-semibold text-rose-800 transition hover:bg-rose-50" type="submit">Reject with reason</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
