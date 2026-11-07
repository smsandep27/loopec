"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireApprovedMember } from "@/lib/auth/member";

export async function updateCartQuantity(formData: FormData) {
  const parsed = z.object({ productId: z.uuid(), quantity: z.coerce.number().int().min(1).max(1000) }).safeParse({
    productId: formData.get("product_id"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) redirect("/cart?error=stock");
  const { supabase, userId } = await requireApprovedMember();
  const { data: product } = await supabase.from("products").select("quantity").eq("id", parsed.data.productId).eq("status", "approved").maybeSingle();
  if (!product || parsed.data.quantity > product.quantity) redirect("/cart?error=stock");
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: parsed.data.quantity })
    .eq("user_id", userId)
    .eq("product_id", parsed.data.productId);
  redirect(error ? "/cart?error=stock" : "/cart");
}

export async function removeCartItem(formData: FormData) {
  const productId = z.uuid().safeParse(formData.get("product_id"));
  if (!productId.success) redirect("/cart");
  const { supabase, userId } = await requireApprovedMember();
  await supabase.from("cart_items").delete().eq("user_id", userId).eq("product_id", productId.data);
  redirect("/cart");
}
