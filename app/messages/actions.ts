"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireApprovedMember } from "@/lib/auth/member";

export async function sendMessage(formData: FormData) {
  const parsed = z.object({
    conversationId: z.uuid(),
    body: z.string().trim().min(1).max(4000),
  }).safeParse({
    conversationId: formData.get("conversation_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) redirect("/messages?error=message");

  const { supabase, userId } = await requireApprovedMember();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conversation) redirect("/messages?error=message");

  const { error } = await supabase.from("messages").insert({
    conversation_id: parsed.data.conversationId,
    sender_id: userId,
    body: parsed.data.body,
  });
  if (error) redirect(`/messages/${parsed.data.conversationId}?error=message`);
  redirect(`/messages/${parsed.data.conversationId}`);
}

export async function markConversationRead(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("conversation_id"));
  if (!id.success) redirect("/messages");
  const { supabase, userId } = await requireApprovedMember();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id.data)
    .neq("sender_id", userId)
    .is("read_at", null);
  redirect(`/messages/${id.data}`);
}
