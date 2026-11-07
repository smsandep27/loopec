import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { AuthShell, FormNotice } from "@/components/auth/auth-shell";
import { authMessage } from "@/lib/auth/messages";
import { getCurrentMember } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { rejectManualPayment, verifyManualPayment } from "@/app/admin/actions";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type Order = { id: string; buyer_id: string; seller_id: string; college_id: string; total_amount: number | string; created_at: string };
type Payment = { id: string; order_id: string; status: string; amount: number | string; provider_payment_id: string | null; review_note: string | null };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Order review" title="Pilot setup is incomplete" description="Payment verification will be available when the pilot database is connected."><Link href="/setup" className="font-semibold text-violet-800">View setup details</Link></AuthShell>;
  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role) || member.profile.suspended_at) {
    return <AuthShell eyebrow="Restricted area" title="College administrators only" description="Your account does not have access to payment review."><Link href="/" className="font-semibold text-violet-800">Return to home</Link></AuthShell>;
  }

  let orderQuery = member.supabase.from("orders").select("id, buyer_id, seller_id, college_id, total_amount, created_at").eq("status", "payment_pending").order("created_at", { ascending: true });
  if (member.profile.role !== "super_admin" && member.profile.college_id) orderQuery = orderQuery.eq("college_id", member.profile.college_id);
  const { data: orderData, error: queryError } = await orderQuery;
  const orders = (orderData ?? []) as Order[];
  const orderIds = orders.map((order) => order.id);
  const userIds = [...new Set(orders.flatMap((order) => [order.buyer_id, order.seller_id]))];
  const [{ data: paymentData }, { data: profileData }] = await Promise.all([
    orderIds.length ? member.supabase.from("payments").select("id, order_id, status, amount, provider_payment_id, review_note").in("order_id", orderIds).eq("method", "manual_upi") : Promise.resolve({ data: [] }),
    userIds.length ? member.supabase.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
  ]);
  const payments = new Map(((paymentData ?? []) as Payment[]).map((payment) => [payment.order_id, payment]));
  const profiles = new Map(((profileData ?? []) as { id: string; full_name: string }[]).map((profile) => [profile.id, profile.full_name]));
  const errorMessage = errorCode === "payment_review" ? authMessage(errorCode) : authMessage(errorCode);

  return (
    <main className="min-h-screen bg-[#f7f6f4] px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/admin" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Admin</span></Link><div className="flex items-center gap-4"><Link className="text-xs font-semibold text-violet-800" href="/admin">Verification queue</Link><form action={signOut}><button className="text-xs font-semibold text-[#77717e]" type="submit">Sign out</button></form></div></header>
      <section className="mx-auto mt-11 max-w-6xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Admin home</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[#e8e5e2] pb-7"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-violet-700"><ShieldCheck size={14} /> Manual payment review</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Order monitoring</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#77717e]">Compare the submitted UPI reference with the college’s payment records. Only an admin decision can move a manual payment to paid.</p></div><span className="rounded-full border border-[#e8e3ec] bg-white px-4 py-2 text-xs font-semibold text-[#5e5765]">{orders.length} awaiting review</span></div>
        <div className="mt-6 space-y-4">{errorMessage ? <FormNotice>{errorMessage}</FormNotice> : null}{params.reviewed ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Payment verified and the order is ready to progress.</p> : null}{params.rejected ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">Reference rejected. The buyer can submit an updated reference.</p> : null}{queryError ? <FormNotice>We could not load pending orders. Check the schema and admin college scope.</FormNotice> : null}
          {!queryError && !orders.length ? <div className="rounded-[26px] border border-dashed border-[#d9d2e0] bg-white px-6 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-800"><CheckCircle2 size={22} /></span><h2 className="mt-4 font-serif text-2xl text-[#28232f]">No payments to review</h2><p className="mt-2 text-sm text-[#77717e]">Submitted UPI references will be listed here.</p></div> : null}
          {orders.map((order) => {
            const payment = payments.get(order.id);
            const hasReference = payment?.status === "pending" && Boolean(payment.provider_payment_id);
            return <article className="grid gap-5 rounded-[24px] border border-[#e8e5e2] bg-white p-5 sm:grid-cols-[minmax(0,1fr)_300px] sm:p-6" key={order.id}>
              <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-900">Payment pending</span><span className="text-[10px] text-[#8d8691]">Order {order.id.slice(0, 8)}</span></div><p className="mt-3 text-sm font-semibold text-[#383240]">Buyer: {profiles.get(order.buyer_id) ?? "Campus member"} <span className="font-normal text-[#918b96]">· Seller: {profiles.get(order.seller_id) ?? "Campus member"}</span></p><p className="mt-1 text-xs text-[#8b8590]">Placed {new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p><p className="mt-3 text-lg font-semibold text-[#302b37]">₹{Number(order.total_amount).toLocaleString("en-IN")}</p>
                {hasReference ? <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3"><small className="block text-[10px] font-bold uppercase tracking-[.12em] text-violet-800">Buyer submitted UPI reference</small><b className="mt-1 block break-all font-mono text-sm tracking-wide text-violet-950">{payment?.provider_payment_id}</b></div> : payment?.review_note ? <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">Last review: {payment.review_note} <span className="block font-semibold">Waiting for the buyer to submit a new reference.</span></div> : <p className="mt-4 flex items-center gap-2 text-xs text-[#817a87]"><Clock3 size={14} /> Waiting for the buyer to submit a reference.</p>}
              </div>
              {hasReference ? <div className="flex flex-col gap-2 sm:justify-center"><form action={verifyManualPayment}><input type="hidden" name="order_id" value={order.id} /><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-violet-950 px-4 text-sm font-semibold text-white hover:bg-violet-900" type="submit"><CheckCircle2 size={15} /> Verify and mark paid</button></form><form action={rejectManualPayment} className="space-y-2"><input type="hidden" name="order_id" value={order.id} /><label className="block text-xs font-semibold text-[#625b6b]">Reason if it cannot be verified<textarea className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-[#e4e0e8] p-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="reason" minLength={5} maxLength={1000} required /></label><button className="min-h-10 w-full rounded-full border border-rose-200 text-sm font-semibold text-rose-800 hover:bg-rose-50" type="submit">Reject reference</button></form></div> : null}
            </article>;
          })}
        </div>
      </section>
    </main>
  );
}
