import Link from "next/link";
import { ArrowLeft, Bell, CheckCheck, RefreshCw } from "lucide-react";
import { requireApprovedMember } from "@/lib/auth/member";
import { signOut } from "@/app/auth/actions";
import { markAllNotificationsRead, markNotificationRead } from "@/app/notifications/actions";

export const instant = false;

type Notice = { id: string; kind: string; title: string; body: string; payload: Record<string, string>; read_at: string | null; created_at: string };

function hrefForNotice(notice: Notice) {
  if (notice.payload.order_id) return `/orders/${notice.payload.order_id}`;
  if (notice.payload.product_id) return `/marketplace/${notice.payload.product_id}`;
  if (notice.payload.conversation_id) return `/messages/${notice.payload.conversation_id}`;
  if (notice.kind === "verification") return "/verification";
  return null;
}

export default async function NotificationsPage() {
  const { supabase, userId } = await requireApprovedMember();
  const { data } = await supabase.from("notifications").select("id, kind, title, body, payload, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  const notices = (data ?? []) as Notice[];
  const unread = notices.filter((notice) => !notice.read_at).length;

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85"><div className="mx-auto flex min-h-[72px] max-w-4xl items-center justify-between px-5 sm:px-8"><Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Notifications</span></Link><form action={signOut}><button className="text-xs font-semibold text-[#77717e]" type="submit">Sign out</button></form></div></header>
      <section className="mx-auto max-w-3xl px-5 py-9 sm:px-8 sm:py-12">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Marketplace</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Campus updates</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Notifications</h1><p className="mt-2 text-sm text-[#77717e]">Private updates about your listings, orders and messages.</p></div><div className="flex items-center gap-2"><Link href="/notifications" className="grid size-10 place-items-center rounded-full border border-[#e4e0e8] bg-white text-[#716a78] hover:text-violet-800" aria-label="Refresh notifications"><RefreshCw size={15} /></Link>{unread ? <form action={markAllNotificationsRead}><button className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet-200 bg-white px-4 text-xs font-semibold text-violet-900 hover:bg-violet-50" type="submit"><CheckCheck size={14} /> Mark all read</button></form> : null}</div></div>
        <div className="mt-7 overflow-hidden rounded-[24px] border border-[#e8e5e2] bg-white">
          {notices.length ? notices.map((notice, index) => {
            const href = hrefForNotice(notice);
            const content = <><span className={`mt-1.5 size-2 shrink-0 rounded-full ${notice.read_at ? "bg-transparent" : "bg-violet-600"}`} aria-hidden="true" /><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-800"><Bell size={17} /></span><span className="min-w-0 flex-1"><b className="block text-sm text-[#383240]">{notice.title}</b><small className="mt-1 block text-xs leading-5 text-[#77717e]">{notice.body}</small><time className="mt-1.5 block text-[10px] text-[#948d98]" dateTime={notice.created_at}>{new Date(notice.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></span></>;
            return <article className={`flex items-start gap-3 px-4 py-4 sm:px-5 ${index ? "border-t border-[#f0edf0]" : ""} ${notice.read_at ? "" : "bg-[#fcfbfd]"}`} key={notice.id}>{href ? <Link className="flex min-w-0 flex-1 items-start gap-3" href={href}>{content}</Link> : <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>}{!notice.read_at ? <form action={markNotificationRead}><input type="hidden" name="notification_id" value={notice.id} /><button className="rounded-full px-2 py-1 text-[10px] font-semibold text-violet-800 hover:bg-violet-50" type="submit">Read</button></form> : null}</article>;
          }) : <div className="px-6 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6f3fa] text-violet-800"><Bell size={21} /></span><h2 className="mt-4 font-serif text-2xl text-[#28232f]">You’re all caught up</h2><p className="mt-2 text-sm text-[#77717e]">Updates will show here when something changes.</p></div>}
        </div>
      </section>
    </main>
  );
}
