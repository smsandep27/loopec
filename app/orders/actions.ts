"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireApprovedMember } from "@/lib/auth/member";

export async function updateOrderStatus(formData: FormData) {
  const parsed = z.object({
    orderId: z.uuid(),
    nextStatus: z.enum(["accepted", "rejected", "payment_pending", "ready_for_pickup", "completed", "cancelled"]),
  }).safeParse({ orderId: formData.get("order_id"), nextStatus: formData.get("next_status") });
  if (!parsed.success) redirect("/orders?error=transition");
  const { supabase } = await requireApprovedMember();
  const { error } = await supabase.rpc("transition_order_status", {
    p_order_id: parsed.data.orderId,
    p_next_status: parsed.data.nextStatus,
  });
  redirect(error ? `/orders/${parsed.data.orderId}?error=transition` : `/orders/${parsed.data.orderId}?updated=1`);
}

export async function submitPaymentReference(formData: FormData) {
  const parsed = z.object({ orderId: z.uuid(), reference: z.string().trim().min(6).max(50).regex(/^[a-zA-Z0-9-]+$/) }).safeParse({
    orderId: formData.get("order_id"),
    reference: formData.get("payment_reference"),
  });
  if (!parsed.success) redirect("/orders?error=payment_reference");
  const { supabase } = await requireApprovedMember();
  const { error } = await supabase.rpc("submit_manual_payment_reference", {
    p_order_id: parsed.data.orderId,
    p_reference: parsed.data.reference,
  });
  if (error?.code === "P0001" && error.message.includes("rate_limit_exceeded")) redirect(`/orders/${parsed.data.orderId}?error=rate_limit`);
  redirect(error ? `/orders/${parsed.data.orderId}?error=payment` : `/orders/${parsed.data.orderId}?reference_submitted=1`);
}

export async function submitOrderReview(formData: FormData) {
  const parsed = z.object({
    orderId: z.uuid(),
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(1200),
  }).safeParse({ orderId: formData.get("order_id"), rating: formData.get("rating"), comment: formData.get("comment") ?? "" });
  if (!parsed.success) redirect("/orders?error=review");
  const { supabase, userId } = await requireApprovedMember();
  const { data: order } = await supabase.from("orders").select("id, buyer_id, seller_id, status").eq("id", parsed.data.orderId).maybeSingle();
  if (!order || order.status !== "completed" || ![order.buyer_id, order.seller_id].includes(userId)) redirect(`/orders/${parsed.data.orderId}?error=review`);
  const reviewedUserId = order.buyer_id === userId ? order.seller_id : order.buyer_id;
  const { error } = await supabase.from("reviews").insert({
    order_id: order.id,
    reviewer_id: userId,
    reviewed_user_id: reviewedUserId,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
  });
  if (error) redirect(`/orders/${parsed.data.orderId}?error=review`);
  redirect(`/orders/${parsed.data.orderId}?reviewed=1`);
}
