import Link from "next/link";
import { ArrowLeft, BadgeCheck, PackageCheck, ShoppingBag } from "lucide-react";
import { requireApprovedMember } from "@/lib/auth/member";
import { authMessage } from "@/lib/auth/messages";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type Order = { id: string; buyer_id: string; seller_id: string; status: string; total_amount: number | string; currency: string; created_at: string; pickup_location_id: string | null };
const statusLabels: Record<string, string> = { pending: "Waiting for seller", accepted: "Accepted", rejected: "Declined", payment_pending: "Payment review", paid: "Paid", ready_for_pickup: "Ready for pickup", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded" };
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const { supabase, userId } = await requireApprovedMember();
  const { data: orderData } = await supabase.from("orders").select("id, buyer_id, seller_id, status, total_amount, currency, created_at, pickup_location_id").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).order("created_at", { ascending: false }).limit(100);
  const orders = (orderData ?? []) as Order[];
  const orderIds = orders.map((order) => order.id);
  const profileIds = [...new Set(orders.map((order) => order.buyer_id === userId ? order.seller_id : order.buyer_id))];
  const [{ data: itemData }, { data: personData }, { data: pickupData }] = await Promise.all([
    orderIds.length ? supabase.from("order_items").select("order_id, product_name, quantity").in("order_id", orderIds) : Promise.resolve({ data: [] }),
    profileIds.length ? supabase.from("profiles").select("id, full_name").in("id", profileIds) : Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const pickupIds = [...new Set(orders.map((order) => order.pickup_location_id).filter((id): id is string => Boolean(id)))];
  const { data: pickupRows } = pickupIds.length ? await supabase.from("pickup_locations").select("id, name").in("id", pickupIds) : { data: pickupData };
  const itemsByOrder = new Map<string, { name: string; quantity: number }[]>();
  for (const item of (itemData ?? []) as { order_id: string; product_name: string; quantity: number }[]) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), { name: item.product_name, quantity: item.quantity }]);
  const people = new Map(((personData ?? []) as { id: string; full_name: string }[]).map((person) => [person.id, person.full_name]));
  const pickupNames = new Map(((pickupRows ?? []) as { id: string; name: string }[]).map((pickup) => [pickup.id, pickup.name]));
  const errorMessage = errorCode ? authMessage(errorCode) : null;

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85"><div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8"><Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Orders</span></Link><form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form></div></header>
      <section className="mx-auto max-w-5xl px-5 py-9 sm:px-8 sm:py-12">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Marketplace</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Your campus exchanges</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Orders</h1><p className="mt-2 text-sm text-[#77717e]">Track the items you’re buying and selling.</p></div><Link href="/messages" className="text-xs font-semibold text-violet-800 hover:text-violet-950">Open messages</Link></div>
        <div className="mt-6 space-y-4">{errorMessage ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{errorMessage}</p> : null}{params.placed ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your order request was sent. You can coordinate with the seller in Messages.</p> : null}
          {orders.length ? orders.map((order) => {
            const buyer = order.buyer_id === userId;
            const otherId = buyer ? order.seller_id : order.buyer_id;
            const items = itemsByOrder.get(order.id) ?? [];
            return <Link className="block rounded-[22px] border border-[#e8e5e2] bg-white p-5 transition hover:border-violet-200 hover:shadow-[0_18px_45px_-40px_rgba(43,29,68,.55)] sm:p-6" href={`/orders/${order.id}`} key={order.id}>
              <div className="flex flex-wrap items-center justify-between gap-3"><span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${order.status === "completed" ? "bg-emerald-50 text-emerald-800" : ["cancelled", "rejected", "refunded"].includes(order.status) ? "bg-[#f2f0f2] text-[#67606d]" : "bg-violet-50 text-violet-800"}`}>{statusLabels[order.status] ?? order.status}</span><span className="text-xs text-[#928b96]">{new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span></div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><span className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-800">{buyer ? <ShoppingBag size={19} /> : <PackageCheck size={19} />}</span><span className="min-w-0 flex-1"><b className="block text-sm text-[#383240]">{buyer ? "Buying from" : "Selling to"} {people.get(otherId) ?? "Campus member"} <BadgeCheck className="inline text-violet-700" size={14} /></b><small className="mt-1 block truncate text-xs text-[#817a87]">{items.map((item) => `${item.name} × ${item.quantity}`).join(" · ")}</small>{order.pickup_location_id ? <small className="mt-1 block text-xs text-[#948d98]">Pickup at {pickupNames.get(order.pickup_location_id) ?? "campus location"}</small> : null}</span><b className="whitespace-nowrap text-lg text-[#302b37]">{currency.format(Number(order.total_amount))}</b></div>
            </Link>;
          }) : <div className="rounded-[26px] border border-dashed border-[#d9d2e0] bg-white px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6f3fa] text-violet-800"><ShoppingBag size={22} /></span><h2 className="mt-4 font-serif text-2xl text-[#28232f]">No campus exchanges yet</h2><p className="mt-2 text-sm text-[#77717e]">When a seller accepts your order or a member buys from you, it’ll appear here.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" href="/marketplace">Browse listings</Link></div>}
        </div>
      </section>
    </main>
  );
}
