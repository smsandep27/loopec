import Link from "next/link";
import { ArrowLeft, BadgeCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { requireApprovedMember } from "@/lib/auth/member";
import { markConversationRead, sendMessage } from "@/app/messages/actions";
import { signOut } from "@/app/auth/actions";
import { LiveMessageThread } from "@/components/messages/live-message-thread";

export const instant = false;

type Conversation = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  order_id: string | null;
};
type Message = { id: string; sender_id: string; body: string; read_at: string | null; created_at: string; conversation_id: string };

export default async function ConversationPage({ params, searchParams }: PageProps<"/messages/[conversationId]">) {
  const [{ conversationId }, search] = await Promise.all([params, searchParams]);
  const { supabase, userId } = await requireApprovedMember();
  const { data: conversationData } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, product_id, order_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversationData) notFound();
  const conversation = conversationData as Conversation;
  const otherId = conversation.buyer_id === userId ? conversation.seller_id : conversation.buyer_id;
  const [{ data: personData }, { data: productData }, { data: messageData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, handle, role, verification_status").eq("id", otherId).maybeSingle(),
    conversation.product_id ? supabase.from("products").select("id, name").eq("id", conversation.product_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("messages").select("id, sender_id, body, read_at, created_at, conversation_id").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(200),
  ]);
  const person = personData as { id: string; full_name: string; handle: string; role: string; verification_status: string } | null;
  const product = productData as { id: string; name: string } | null;
  const messages = (messageData ?? []) as Message[];
  const unreadCount = messages.filter((message) => message.sender_id !== userId && !message.read_at).length;
  const searchValue = await search;
  const error = Array.isArray(searchValue.error) ? searchValue.error[0] : searchValue.error;

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85"><div className="mx-auto flex min-h-[72px] max-w-4xl items-center justify-between px-5 sm:px-8"><Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC</Link><div className="flex items-center gap-4"><Link href="/messages" className="text-xs font-semibold text-violet-800">All messages</Link><form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e] hover:text-violet-900">Sign out</button></form></div></div></header>
      <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-4xl flex-col px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3 border-b border-[#e8e5e2] pb-5">
          <Link href="/messages" className="grid size-9 place-items-center rounded-full text-[#77717e] hover:bg-white" aria-label="Back to messages"><ArrowLeft size={16} /></Link>
          <Link href={person ? `/members/${person.handle}` : "/messages"} className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-50 font-serif text-lg text-violet-800">{(person?.full_name ?? "M").slice(0, 1).toUpperCase()}</Link>
          <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 truncate text-sm font-semibold text-[#383240]">{person?.full_name ?? "Campus member"}{person?.verification_status === "approved" ? <BadgeCheck size={14} className="shrink-0 text-violet-700" /> : null}</p><p className="mt-1 truncate text-xs text-[#85808a]">{product ? `About ${product.name}` : conversation.order_id ? "Order coordination" : "Campus conversation"}</p></div>
          <Link href={`/messages/${conversation.id}`} className="grid size-9 place-items-center rounded-full text-[#8b8590] hover:bg-white hover:text-violet-800" aria-label="Refresh messages"><RefreshCw size={15} /></Link>
        </div>
        <LiveMessageThread conversationId={conversation.id} currentUserId={userId} initialMessages={messages} />
        {unreadCount ? <form action={markConversationRead} className="mb-3 text-right"><input type="hidden" name="conversation_id" value={conversation.id} /><button type="submit" className="text-xs font-semibold text-violet-800 hover:text-violet-950">Mark {unreadCount} message{unreadCount === 1 ? "" : "s"} as read</button></form> : null}
        {error ? <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{error === "rate_limit" ? "You’ve sent several messages in a short time. Please wait a little before sending another." : "We couldn’t send that message. Please try again."}</p> : null}
        <form action={sendMessage} className="rounded-[22px] border border-[#e5e0e8] bg-white p-2.5 shadow-[0_15px_40px_-35px_rgba(43,29,68,.4)]">
          <input type="hidden" name="conversation_id" value={conversation.id} />
          <label className="sr-only" htmlFor="message-body">Write a message</label>
          <div className="flex items-end gap-2"><textarea id="message-body" name="body" className="min-h-12 max-h-40 flex-1 resize-y rounded-2xl bg-[#f8f7f8] px-4 py-3 text-sm leading-5 outline-none focus:ring-4 focus:ring-violet-100" placeholder="Write a thoughtful message…" maxLength={4000} required /><button type="submit" className="min-h-12 shrink-0 rounded-full bg-violet-950 px-5 text-sm font-semibold text-white transition hover:bg-violet-900">Send</button></div>
        </form>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[#918b96]"><ShieldCheck size={12} className="text-violet-700" /> Messages are only visible to this conversation’s members.</p>
      </section>
    </main>
  );
}
