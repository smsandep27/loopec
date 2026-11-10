"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApprovedMember } from "@/lib/auth/member";
import { createStorageAdminClient } from "@/lib/supabase/admin";

const listingFields = z.object({
  categoryId: z.uuid(),
  name: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(5000),
  price: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).transform(Number).refine((value) => value <= 9_999_999_999.99),
  condition: z.enum(["new", "like_new", "good", "used"]),
  quantity: z.coerce.number().int().min(1).max(1000),
});

function readFields(formData: FormData) {
  return listingFields.safeParse({
    categoryId: formData.get("category_id"),
    name: formData.get("name"),
    description: formData.get("description"),
    price: String(formData.get("price") ?? ""),
    condition: formData.get("item_condition"),
    quantity: formData.get("quantity"),
  });
}

function getImageFiles(formData: FormData) {
  return formData.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
}

function isRateLimitError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "P0001" && error.message?.includes("rate_limit_exceeded");
}

function detectImage(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

async function uploadImages({
  supabase,
  storageAdmin,
  files,
  userId,
  productId,
  productName,
  sortOffset,
}: {
  supabase: SupabaseClient;
  storageAdmin: SupabaseClient | null;
  files: File[];
  userId: string;
  productId: string;
  productName: string;
  sortOffset: number;
}) {
  const uploaded: string[] = [];
  const records: { product_id: string; storage_path: string; alt_text: string; sort_order: number }[] = [];
  const uploadStorage = storageAdmin ? storageAdmin.storage : supabase.storage;

  for (const [index, file] of files.entries()) {
    if (file.size > 4 * 1024 * 1024) {
      await uploadStorage.from("product-images").remove(uploaded);
      return { error: "size", uploaded, records };
    }
    const fileType = detectImage(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
    if (!fileType) {
      await uploadStorage.from("product-images").remove(uploaded);
      return { error: "type", uploaded, records };
    }
    const path = `${userId}/${productId}/${crypto.randomUUID()}.${fileType.extension}`;
    const { data: authorized, error: limitError } = await supabase.rpc("authorize_private_upload", {
      p_bucket_id: "product-images",
      p_name: path,
    });
    if (limitError && limitError.code !== "PGRST202" && limitError.code !== "42883") {
      await uploadStorage.from("product-images").remove(uploaded);
      return { error: isRateLimitError(limitError) ? "rate_limit" : "upload", uploaded, records };
    }
    if (!limitError && !authorized) {
      await uploadStorage.from("product-images").remove(uploaded);
      return { error: "upload", uploaded, records };
    }
    const { error } = await uploadStorage.from("product-images").upload(path, file, {
      contentType: fileType.mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      await uploadStorage.from("product-images").remove(uploaded);
      return { error: "upload", uploaded, records };
    }
    uploaded.push(path);
    records.push({ product_id: productId, storage_path: path, alt_text: `${productName} photo ${sortOffset + index + 1}`, sort_order: sortOffset + index });
  }

  if (records.length) {
    const { error } = await supabase.from("product_images").insert(records);
    if (error) {
      await uploadStorage.from("product-images").remove(uploaded);
      return { error: "upload", uploaded: [], records: [] };
    }
  }
  return { error: null, uploaded, records };
}

export async function createListing(formData: FormData) {
  const fields = readFields(formData);
  const files = getImageFiles(formData);
  if (!fields.success || files.length < 1 || files.length > 5) redirect("/listings/new?error=invalid");
  const { supabase, userId, profile } = await requireApprovedMember();
  const storageAdmin = createStorageAdminClient();
  if (!storageAdmin) redirect("/setup#storage-key");
  if (!profile.college_id) redirect("/listings/new?error=invalid");
  const { data: category } = await supabase.from("categories").select("id").eq("id", fields.data.categoryId).eq("is_active", true).maybeSingle();
  if (!category) redirect("/listings/new?error=invalid");

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      college_id: profile.college_id,
      seller_id: userId,
      category_id: fields.data.categoryId,
      name: fields.data.name,
      description: fields.data.description,
      price: fields.data.price,
      item_condition: fields.data.condition,
      quantity: fields.data.quantity,
    })
    .select("id")
    .single();
  if (isRateLimitError(error)) redirect("/listings/new?error=rate_limit");
  if (error || !product) redirect("/listings/new?error=save");

  const uploaded = await uploadImages({ supabase, storageAdmin, files, userId, productId: product.id, productName: fields.data.name, sortOffset: 0 });
  if (uploaded.error) {
    await supabase.from("products").delete().eq("id", product.id);
    redirect(`/listings/new?error=${uploaded.error}`);
  }

  const { error: submitError } = await supabase.rpc("submit_product", { p_product_id: product.id });
  if (submitError) redirect(`/listings/${product.id}/edit?error=submit`);
  redirect("/listings?submitted=1");
}

export async function updateListing(formData: FormData) {
  const productId = z.uuid().safeParse(formData.get("product_id"));
  const fields = readFields(formData);
  const files = getImageFiles(formData);
  if (!productId.success || !fields.success || files.length > 5) redirect("/listings?error=invalid");
  const { supabase, userId } = await requireApprovedMember();
  const storageAdmin = files.length ? createStorageAdminClient() : null;
  if (files.length && !storageAdmin) redirect(`/setup#storage-key`);
  const { data: product } = await supabase.from("products").select("id, seller_id, status, name").eq("id", productId.data).maybeSingle();
  if (!product || product.seller_id !== userId || !["draft", "rejected"].includes(product.status)) redirect("/listings?error=unavailable");
  const { data: category } = await supabase.from("categories").select("id").eq("id", fields.data.categoryId).eq("is_active", true).maybeSingle();
  if (!category) redirect(`/listings/${product.id}/edit?error=invalid`);

  const { error } = await supabase.from("products").update({
    category_id: fields.data.categoryId,
    name: fields.data.name,
    description: fields.data.description,
    price: fields.data.price,
    item_condition: fields.data.condition,
    quantity: fields.data.quantity,
  }).eq("id", product.id);
  if (error) redirect(`/listings/${product.id}/edit?error=save`);

  if (files.length) {
    const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", product.id);
    if ((count ?? 0) + files.length > 20) redirect(`/listings/${product.id}/edit?error=too_many_images`);
    const uploaded = await uploadImages({ supabase, storageAdmin, files, userId, productId: product.id, productName: fields.data.name, sortOffset: count ?? 0 });
    if (uploaded.error) redirect(`/listings/${product.id}/edit?error=${uploaded.error}`);
  }
  redirect(`/listings/${product.id}/edit?saved=1`);
}

export async function removeListingImage(formData: FormData) {
  const imageId = z.uuid().safeParse(formData.get("image_id"));
  if (!imageId.success) redirect("/listings");
  const { supabase, userId } = await requireApprovedMember();
  const { data: image } = await supabase.from("product_images").select("id, product_id, storage_path").eq("id", imageId.data).maybeSingle();
  if (!image) redirect("/listings");
  const { data: product } = await supabase.from("products").select("seller_id, status").eq("id", image.product_id).maybeSingle();
  if (!product || product.seller_id !== userId || !["draft", "rejected"].includes(product.status)) redirect("/listings");
  const { error: storageError } = await supabase.storage.from("product-images").remove([image.storage_path]);
  if (storageError) redirect(`/listings/${image.product_id}/edit?error=image_remove`);
  const { error } = await supabase.from("product_images").delete().eq("id", image.id);
  redirect(error ? `/listings/${image.product_id}/edit?error=image_remove` : `/listings/${image.product_id}/edit?removed=1`);
}

export async function submitListing(formData: FormData) {
  const productId = z.uuid().safeParse(formData.get("product_id"));
  if (!productId.success) redirect("/listings");
  const { supabase, userId } = await requireApprovedMember();
  const { data: product } = await supabase.from("products").select("id, seller_id, status").eq("id", productId.data).maybeSingle();
  if (!product || product.seller_id !== userId || !["draft", "rejected"].includes(product.status)) redirect("/listings?error=unavailable");
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", product.id);
  if (!count) redirect(`/listings/${product.id}/edit?error=image_required`);
  const { error } = await supabase.rpc("submit_product", { p_product_id: product.id });
  redirect(error ? `/listings/${product.id}/edit?error=submit` : "/listings?submitted=1");
}

export async function deleteListing(formData: FormData) {
  const productId = z.uuid().safeParse(formData.get("product_id"));
  if (!productId.success) redirect("/listings");
  const { supabase, userId } = await requireApprovedMember();
  const { data: product } = await supabase.from("products").select("id, seller_id, status").eq("id", productId.data).maybeSingle();
  if (!product || product.seller_id !== userId || !["draft", "rejected"].includes(product.status)) redirect("/listings?error=unavailable");
  const { data: images } = await supabase.from("product_images").select("storage_path").eq("product_id", product.id);
  const paths = (images ?? []).map((image) => (image as { storage_path: string }).storage_path);
  if (paths.length) {
    const { error } = await supabase.storage.from("product-images").remove(paths);
    if (error) redirect(`/listings/${product.id}/edit?error=image_remove`);
  }
  const { error } = await supabase.from("products").delete().eq("id", product.id);
  redirect(error ? `/listings/${product.id}/edit?error=delete` : "/listings?deleted=1");
}

export async function withdrawListing(formData: FormData) {
  const productId = z.uuid().safeParse(formData.get("product_id"));
  if (!productId.success) redirect("/listings?error=unavailable");
  const { supabase, userId } = await requireApprovedMember();
  const { data: product } = await supabase.from("products").select("id, seller_id, status").eq("id", productId.data).maybeSingle();
  if (!product || product.seller_id !== userId || product.status !== "approved") redirect("/listings?error=unavailable");
  const { error } = await supabase.rpc("withdraw_product", { p_product_id: product.id });
  redirect(error ? "/listings?error=withdraw" : "/listings?withdrawn=1");
}
