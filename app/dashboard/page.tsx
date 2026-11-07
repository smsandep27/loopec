import Link from "next/link";
import { ArrowRight, BadgeCheck, Bell, Box, CirclePlus, MessageCircle, PackageCheck, Store, TrendingUp, UserRound } from "lucide-react";
import { requireApprovedMember } from "@/lib/auth/member";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type Listing = { id: string; name: string; price: number | string; status: string; created_at: string };
type Order = { id: string; buyer_id: string; status: string; total_amount: number | string; created_at: string };
type DashboardMetrics = { total_listings: number; active_listings: number; pending_listings: number; pending_orders: number; completed_orders: number; paid_sales: number | string; review_count: number; average_rating: number | string | null };
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function DashboardPage() {
  const { supabase, userId, profile } = await requireApprovedMember();
  const [{ data: listingsData, count: listingCount }, { data: ordersData, count: orderCount }, { data: metricsData }] = await Promise.all([
    supabase.from("products").select("id, name, price, status, created_at", { count: "exact" }).eq("seller_id", userId).order("created_at", { ascending: false }).limit(100),
    supabase.from("orders").select("id, buyer_id, status, total_amount, created_at", { count: "exact" }).eq("seller_id", userId).order("created_at", { ascending: false }).limit(100),
    supabase.rpc("seller_dashboard_metrics"),
  ]);
  const listings = (listingsData ?? []) as Listing[];
  const orders = (ordersData ?? []) as Order[];
  const metrics = ((metricsData ?? []) as DashboardMetrics[])[0];
  const [{ count: wishlistCount }, { count: unreadCount }] = await Promise.all([
    supabase.from("wishlists").select("product_id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);
  const activeListings = metrics?.active_listings ?? 0;
  const pendingOrders = metrics?.pending_orders ?? 0;
  const completedOrders = metrics?.completed_orders ?? 0;
  const paidSales = Number(metrics?.paid_sales ?? 0);
  const averageRating = metrics?.average_rating ? Number(metrics.average_rating) : null;
  const recentOrders = orders.slice(0, 5);
  const buyerIds = [...new Set(recentOrders.map((order) => order.buyer_id))];
  const { data: buyerData } = buyerIds.length ? await supabase.from("profiles").select("id, full_name").in("id", buyerIds) : { data: [] };
  const buyers = new Map(((buyerData ?? []) as { id: string; full_name: string }[]).map((buyer) => [buyer.id, buyer.full_name]));
  const needsReview = listings.filter((listing) => listing.status === "pending").length;

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85"><div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8"><Link href="/dashboard" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Seller studio</span></Link><nav className="flex items-center gap-4"><Link href="/marketplace" className="text-xs font-semibold text-violet-800">Marketplace</Link><Link href="/profile" className="text-xs font-semibold text-[#6f6876]">Profile</Link><form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form></nav></div></header>
      <section className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-violet-700"><Store size={14} /> Seller studio</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Good morning, {profile.full_name.split(" ")[0]}.</h1><p className="mt-2 text-sm text-[#77717e]">Your campus listings and exchanges, in one place.</p></div><Link className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet-950 px-5 text-sm font-semibold text-white hover:bg-violet-900" href="/listings/new"><CirclePlus size={15} /> Create a listing</Link></div>
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: Box, label: "Total listings", value: metrics?.total_listings ?? listingCount ?? listings.length, href: "/listings", note: `${activeListings} currently live` },
            { icon: PackageCheck, label: "Pending orders", value: pendingOrders, href: "/orders", note: `${orderCount ?? orders.length} seller orders` },
            { icon: TrendingUp, label: "Sales paid", value: currency.format(paidSales), href: "/orders", note: `${completedOrders} handovers complete` },
            { icon: BadgeCheck, label: "Member rating", value: averageRating ? `${averageRating.toFixed(1)} / 5` : "New seller", href: `/members/${profile.handle}`, note: `${metrics?.review_count ?? 0} member reviews` },
          ].map(({ icon: Icon, label, value, href, note }) => <Link className="rounded-[22px] border border-[#e8e5e2] bg-white p-4 transition hover:border-violet-200 sm:p-5" href={href} key={label}><span className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-800"><Icon size={17} /></span><ArrowRight size={14} className="text-[#aaa3ad]" /></span><small className="mt-4 block text-[11px] font-medium text-[#88818d]">{label}</small><b className="mt-1 block truncate text-xl font-semibold tracking-tight text-[#302b37] sm:text-2xl">{value}</b><small className="mt-1 block text-[10px] text-[#928b96]">{note}</small></Link>)}
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
          <section className="rounded-[24px] border border-[#e8e5e2] bg-white p-5 sm:p-6"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Seller activity</p><h2 className="mt-2 font-serif text-2xl tracking-[-.04em] text-[#302b37]">Recent orders</h2></div><Link className="text-xs font-semibold text-violet-800" href="/orders">View all</Link></div>
            {recentOrders.length ? <div className="mt-4 divide-y divide-[#f0edf0]">{recentOrders.map((order) => <Link className="flex items-center gap-3 py-3 first:pt-0" href={`/orders/${order.id}`} key={order.id}><span className="grid size-9 place-items-center rounded-xl bg-[#f7f5f8] text-violet-800"><PackageCheck size={16} /></span><span className="min-w-0 flex-1"><b className="block truncate text-sm text-[#3b3542]">{buyers.get(order.buyer_id) ?? "Campus member"}</b><small className="mt-1 block text-xs text-[#89828e]">{order.status.replaceAll("_", " ")} · {new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</small></span><b className="text-sm text-[#37313e]">{currency.format(Number(order.total_amount))}</b></Link>)}</div> : <div className="mt-5 rounded-2xl bg-[#faf9fb] px-5 py-9 text-center"><p className="font-serif text-xl text-[#383240]">Your first order is on the way.</p><p className="mt-1 text-xs text-[#817a87]">Approved campus listings will show up here.</p></div>}
          </section>
          <aside className="space-y-4">
            <div className="rounded-[24px] bg-[#2c2339] p-5 text-white sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-200">Your seller profile</p><h2 className="mt-2 font-serif text-2xl">{profile.full_name}</h2><p className="mt-1 text-xs text-violet-100/70">@{profile.handle} · {profile.role}</p><Link className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-violet-100 hover:text-white" href="/profile">Manage profile <ArrowRight size={14} /></Link></div>
            <div className="rounded-[24px] border border-[#e8e5e2] bg-white p-5 sm:p-6"><h2 className="text-sm font-semibold text-[#393341]">Quick links</h2><div className="mt-3 space-y-1"><Link className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-[#655e6b] hover:bg-[#f8f7f8] hover:text-violet-900" href="/listings"><Box size={15} /> Manage listings <span className="ml-auto text-[#99929c]">{needsReview ? `${needsReview} in review` : ""}</span></Link><Link className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-[#655e6b] hover:bg-[#f8f7f8] hover:text-violet-900" href="/orders"><PackageCheck size={15} /> Orders</Link><Link className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-[#655e6b] hover:bg-[#f8f7f8] hover:text-violet-900" href="/messages"><MessageCircle size={15} /> Messages</Link><Link className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-[#655e6b] hover:bg-[#f8f7f8] hover:text-violet-900" href="/notifications"><Bell size={15} /> Alerts{unreadCount ? ` (${unreadCount})` : ""}</Link><Link className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-[#655e6b] hover:bg-[#f8f7f8] hover:text-violet-900" href={`/members/${profile.handle}`}><UserRound size={15} /> Public member profile</Link></div></div>
          </aside>
        </div>
        <div className="mt-5 flex justify-end text-xs text-[#928b96]">{wishlistCount ?? 0} items saved to your wishlist · {listingCount ?? listings.length} listings found · {orderCount ?? orders.length} orders</div>
      </section>
    </main>
  );
}
