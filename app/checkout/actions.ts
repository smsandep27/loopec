"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireApprovedMember } from "@/lib/auth/member";

export async function createOrders(formData: FormData) {
  const rawProductId = formData.get("product_id");
  const parsed = z.object({ pickupLocationId: z.uuid(), idempotencyKey: z.uuid(), productId: z.uuid().optional() }).safeParse({
    pickupLocationId: formData.get("pickup_location_id"),
    idempotencyKey: formData.get("idempotency_key"),
    productId: typeof rawProductId === "string" && rawProductId ? rawProductId : undefined,
  });
  if (!parsed.success) redirect("/checkout?error=checkout");
  const { supabase } = await requireApprovedMember();
  const { error } = parsed.data.productId
    ? await supabase.rpc("create_single_checkout_order", {
        p_product_id: parsed.data.productId,
        p_pickup_location_id: parsed.data.pickupLocationId,
        p_idempotency_key: parsed.data.idempotencyKey,
      })
    : await supabase.rpc("create_checkout_orders", {
        p_pickup_location_id: parsed.data.pickupLocationId,
        p_idempotency_key: parsed.data.idempotencyKey,
      });
  if (error?.code === "P0001" && error.message.includes("rate_limit_exceeded")) redirect("/checkout?error=rate_limit");
  if (error) redirect("/checkout?error=checkout");
  redirect("/orders?placed=1");
}
