"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireApprovedMember } from "@/lib/auth/member";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/marketplace";
}

export async function toggleWishlist(formData: FormData) {
  const productId = z.uuid().safeParse(formData.get("product_id"));
  if (!productId.success) redirect("/marketplace");
  const returnTo = safeReturnTo(typeof formData.get("return_to") === "string" ? formData.get("return_to") as string : null);
  const { supabase, userId } = await requireApprovedMember();
  const { data: existing } = await supabase
    .from("wishlists")
    .select("product_id")
    .eq("user_id", userId)
    .eq("product_id", productId.data)
    .maybeSingle();

  if (existing) {
    await supabase.from("wishlists").delete().eq("user_id", userId).eq("product_id", productId.data);
  } else {
    await supabase.from("wishlists").insert({ user_id: userId, product_id: productId.data });
  }
  redirect(returnTo);
}

export async function addToCart(formData: FormData) {
  const productId = z.uuid().safeParse(formData.get("product_id"));
  if (!productId.success) redirect("/marketplace");
  const { supabase, userId } = await requireApprovedMember();
  const { data: product } = await supabase
    .from("products")
    .select("id, seller_id, quantity")
    .eq("id", productId.data)
    .eq("status", "approved")
    .maybeSingle();
  if (!product || product.seller_id === userId) redirect(`/marketplace/${productId.data}?error=unavailable`);

  const { data: existing } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("user_id", userId)
    .eq("product_id", productId.data)
    .maybeSingle();
  const nextQuantity = (existing?.quantity ?? 0) + 1;
  if (nextQuantity > product.quantity) redirect(`/marketplace/${productId.data}?error=stock`);

  const { error } = existing
    ? await supabase.from("cart_items").update({ quantity: nextQuantity }).eq("user_id", userId).eq("product_id", productId.data)
    : await supabase.from("cart_items").insert({ user_id: userId, product_id: productId.data, quantity: 1 });
  if (error) redirect(`/marketplace/${productId.data}?error=stock`);
  redirect("/cart?added=1");
}

export async function buyNow(formData: FormData) {
  const productId = z.uuid().safeParse(formData.get("product_id"));
  if (!productId.success) redirect("/marketplace");
  const { supabase, userId } = await requireApprovedMember();
  const { data: product } = await supabase
    .from("products")
    .select("id, seller_id, quantity")
    .eq("id", productId.data)
    .eq("status", "approved")
    .maybeSingle();
  if (!product || product.seller_id === userId || product.quantity < 1) {
    redirect(`/marketplace/${productId.data}?error=unavailable`);
  }
  redirect(`/checkout?product_id=${product.id}`);
}

export async function startConversation(formData: FormData) {
  const productId = z.uuid().safeParse(formData.get("product_id"));
  if (!productId.success) redirect("/marketplace");
  const { supabase, userId, profile } = await requireApprovedMember();
  const { data: product } = await supabase
    .from("products")
    .select("id, seller_id")
    .eq("id", productId.data)
    .eq("status", "approved")
    .maybeSingle();
  if (!product || product.seller_id === userId || !profile.college_id) redirect(`/marketplace/${productId.data}?error=unavailable`);

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", userId)
    .eq("seller_id", product.seller_id)
    .eq("product_id", product.id)
    .maybeSingle();
  if (existing) redirect(`/messages/${existing.id}`);

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      college_id: profile.college_id,
      buyer_id: userId,
      seller_id: product.seller_id,
      product_id: product.id,
    })
    .select("id")
    .single();
  if (error || !created) {
    const { data: raced } = await supabase
      .from("conversations")
      .select("id")
      .eq("buyer_id", userId)
      .eq("seller_id", product.seller_id)
      .eq("product_id", product.id)
      .maybeSingle();
    if (raced) redirect(`/messages/${raced.id}`);
    redirect(`/marketplace/${productId.data}?error=unavailable`);
  }
  redirect(`/messages/${created.id}`);
}

export async function reportListing(formData: FormData) {
  const parsed = z.object({
    productId: z.uuid(),
    reason: z.enum(["prohibited_item", "misleading_listing", "safety", "harassment", "other"]),
    details: z.string().trim().max(2000),
  }).safeParse({
    productId: formData.get("product_id"),
    reason: formData.get("reason"),
    details: formData.get("details") ?? "",
  });
  if (!parsed.success) redirect("/marketplace");
  const { supabase, userId } = await requireApprovedMember();
  const { data: product } = await supabase.from("products").select("id, seller_id").eq("id", parsed.data.productId).eq("status", "approved").maybeSingle();
  if (!product || product.seller_id === userId) redirect(`/marketplace/${parsed.data.productId}?error=unavailable`);
  const { error } = await supabase.from("reports").insert({
    reporter_id: userId,
    product_id: product.id,
    reported_user_id: product.seller_id,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });
  if (error?.code === "P0001" && error.message.includes("rate_limit_exceeded")) redirect(`/marketplace/${product.id}?error=rate_limit`);
  redirect(error ? `/marketplace/${product.id}?error=unavailable` : `/marketplace/${product.id}?reported=1`);
}
