"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  conversation_id: string;
};

export function LiveMessageThread({
  conversationId,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [isLive, setIsLive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const message = payload.new as Message;
        if (!message.id || message.conversation_id !== conversationId) return;
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const updated = payload.new as Message;
        if (!updated.id || updated.conversation_id !== conversationId) return;
        setMessages((current) => current.map((item) => item.id === updated.id ? { ...item, read_at: updated.read_at } : item));
      })
      .subscribe((status) => setIsLive(status === "SUBSCRIBED"));

    return () => {
      setIsLive(false);
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "end" });
  }, [messages.length]);

  return (
    <>
      <div className="mb-2 flex justify-end" aria-live="polite">
        <span className={`inline-flex items-center gap-1.5 text-[10px] ${isLive ? "text-emerald-700" : "text-[#918b96]"}`}>
          <span className={`size-1.5 rounded-full ${isLive ? "bg-emerald-500" : "bg-[#c4bec9]"}`} />
          {isLive ? "Live updates on" : "Connecting to live updates…"}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto py-6" aria-live="polite" aria-relevant="additions text">
        {messages.length ? messages.map((message) => {
          const mine = message.sender_id === currentUserId;
          return <div className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}><div className={`max-w-[84%] rounded-[20px] px-4 py-3 sm:max-w-[72%] ${mine ? "rounded-br-md bg-violet-950 text-white" : "rounded-bl-md border border-[#e8e5e2] bg-white text-[#3d3744]"}`}><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p><time className={`mt-1.5 block text-right text-[10px] ${mine ? "text-violet-200" : "text-[#948d98]"}`} dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></div></div>;
        }) : <div className="grid min-h-[280px] place-items-center"><div className="max-w-xs text-center"><p className="mt-4 font-serif text-2xl text-[#302b37]">Start with a hello.</p><p className="mt-2 text-sm leading-6 text-[#817a87]">Keep the conversation here while you arrange a campus pickup.</p></div></div>}
        <div ref={bottomRef} />
      </div>
    </>
  );
}
