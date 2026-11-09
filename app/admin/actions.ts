"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentMember } from "@/lib/auth/member";

export async function reviewVerification(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const parsed = z.object({
    verificationId: z.uuid(),
    decision: z.enum(["approved", "rejected"]),
    rejectionReason: z.string().trim().max(1000),
  }).safeParse({
    verificationId: formData.get("verification_id"),
    decision: formData.get("decision"),
    rejectionReason: formData.get("rejection_reason") ?? "",
  });
  if (!parsed.success || (parsed.data.decision === "rejected" && parsed.data.rejectionReason.length < 5)) {
    redirect("/admin?error=verification_review");
  }

  // Server Actions are directly callable, so re-read claims and the role on every request.
  const member = await getCurrentMember();
  if (!member.userId || !member.profile ||
    !["college_admin", "super_admin"].includes(member.profile.role) ||
    member.profile.suspended_at) {
    redirect("/auth/sign-in?error=session");
  }

  const { error } = await member.supabase.rpc("review_verification", {
    p_verification_id: parsed.data.verificationId,
    p_decision: parsed.data.decision,
    p_rejection_reason: parsed.data.decision === "rejected" ? parsed.data.rejectionReason : null,
  });
  if (error) redirect("/admin?error=verification_review");
  redirect("/admin?reviewed=1");
}

export async function moderateProduct(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const parsed = z.object({
    productId: z.uuid(),
    decision: z.enum(["approved", "rejected"]),
    notes: z.string().trim().max(1000),
  }).safeParse({
    productId: formData.get("product_id"),
    decision: formData.get("decision"),
    notes: formData.get("moderator_notes") ?? "",
  });
  if (!parsed.success || (parsed.data.decision === "rejected" && parsed.data.notes.length < 5)) {
    redirect("/admin/listings?error=moderation");
  }

  const member = await getCurrentMember();
  if (!member.userId || !member.profile ||
    !["college_admin", "super_admin"].includes(member.profile.role) ||
    member.profile.suspended_at) {
    redirect("/auth/sign-in?error=session");
  }

  const { error } = await member.supabase.rpc("moderate_product", {
    p_product_id: parsed.data.productId,
    p_decision: parsed.data.decision,
    p_moderator_notes: parsed.data.decision === "rejected" ? parsed.data.notes : null,
  });
  if (error) redirect("/admin/listings?error=moderation");
  redirect("/admin/listings?reviewed=1");
}

export async function verifyManualPayment(formData: FormData) {
  const orderId = z.uuid().safeParse(formData.get("order_id"));
  if (!orderId.success) redirect("/admin/orders?error=payment_review");
  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role) || member.profile.suspended_at) {
    redirect("/auth/sign-in?error=session");
  }
  const { error } = await member.supabase.rpc("transition_order_status", {
    p_order_id: orderId.data,
    p_next_status: "paid",
  });
  if (error) redirect("/admin/orders?error=payment_review");
  redirect("/admin/orders?reviewed=1");
}

export async function rejectManualPayment(formData: FormData) {
  const parsed = z.object({ orderId: z.uuid(), reason: z.string().trim().min(5).max(1000) }).safeParse({
    orderId: formData.get("order_id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect("/admin/orders?error=payment_review");
  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role) || member.profile.suspended_at) {
    redirect("/auth/sign-in?error=session");
  }
  const { error } = await member.supabase.rpc("reject_manual_payment_reference", {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });
  if (error) redirect("/admin/orders?error=payment_review");
  redirect("/admin/orders?rejected=1");
}

export async function setMemberSuspension(formData: FormData) {
  const parsed = z.object({
    userId: z.uuid(),
    suspend: z.enum(["true", "false"]),
    reason: z.string().trim().max(1000),
  }).safeParse({
    userId: formData.get("user_id"),
    suspend: formData.get("suspend"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success || (parsed.data.suspend === "true" && parsed.data.reason.length < 5)) {
    redirect("/admin/members?error=member_review");
  }
  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role) || member.profile.suspended_at) {
    redirect("/auth/sign-in?error=session");
  }
  const { error } = await member.supabase.rpc("set_member_suspension", {
    p_user_id: parsed.data.userId,
    p_suspend: parsed.data.suspend === "true",
    p_reason: parsed.data.suspend === "true" ? parsed.data.reason : null,
  });
  if (error) redirect("/admin/members?error=member_review");
  redirect(parsed.data.suspend === "true" ? "/admin/members?suspended=1" : "/admin/members?reinstated=1");
}

export async function reviewReport(formData: FormData) {
  const parsed = z.object({
    reportId: z.uuid(),
    decision: z.enum(["under_review", "resolved", "dismissed"]),
    notes: z.string().trim().max(2000),
  }).safeParse({
    reportId: formData.get("report_id"),
    decision: formData.get("decision"),
    notes: formData.get("moderator_notes") ?? "",
  });
  if (!parsed.success) redirect("/admin/reports?error=review");
  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role) || member.profile.suspended_at) {
    redirect("/auth/sign-in?error=session");
  }
  const { error } = await member.supabase.rpc("review_report", {
    p_report_id: parsed.data.reportId,
    p_decision: parsed.data.decision,
    p_moderator_notes: parsed.data.notes || null,
  });
  if (error) redirect("/admin/reports?error=review");
  redirect("/admin/reports?updated=1");
}

async function requireSuperAdmin() {
  const member = await getCurrentMember();
  if (!member.userId || !member.profile || member.profile.role !== "super_admin" || member.profile.suspended_at) {
    redirect("/auth/sign-in?error=session");
  }
  return member;
}

export async function updateCommission(formData: FormData) {
  const percent = z.coerce.number().finite().min(0).max(100).safeParse(formData.get("percent"));
  if (!percent.success) redirect("/admin/settings?error=settings");
  const member = await requireSuperAdmin();
  const { error } = await member.supabase.rpc("update_commission_percent", { p_percent: Math.round(percent.data * 100) / 100 });
  redirect(error ? "/admin/settings?error=settings" : "/admin/settings?saved=1");
}

export async function addCategory(formData: FormData) {
  const parsed = z.object({
    name: z.string().trim().min(2).max(80),
    slug: z.string().trim().max(80),
  }).safeParse({ name: formData.get("name"), slug: formData.get("slug") ?? "" });
  if (!parsed.success) redirect("/admin/settings?error=category");
  const member = await requireSuperAdmin();
  const slug = (parsed.data.slug || parsed.data.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) redirect("/admin/settings?error=category");
  const { data: lastCategory } = await member.supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const sortOrder = Math.min(Number(lastCategory?.sort_order ?? 0) + 10, 32767);
  const { error } = await member.supabase.from("categories").insert({ name: parsed.data.name, slug, sort_order: sortOrder });
  redirect(error ? "/admin/settings?error=category" : "/admin/settings?category_added=1");
}

export async function toggleCategory(formData: FormData) {
  const parsed = z.object({ categoryId: z.uuid(), active: z.enum(["true", "false"]) }).safeParse({
    categoryId: formData.get("category_id"),
    active: formData.get("active"),
  });
  if (!parsed.success) redirect("/admin/settings?error=category");
  const member = await requireSuperAdmin();
  const { error } = await member.supabase.from("categories").update({ is_active: parsed.data.active === "true" }).eq("id", parsed.data.categoryId);
  redirect(error ? "/admin/settings?error=category" : "/admin/settings?category_saved=1");
}

export async function savePickupLocation(formData: FormData) {
  const parsed = z.object({
    locationId: z.union([z.literal(""), z.uuid()]),
    collegeId: z.uuid(),
    name: z.string().trim().min(2).max(120),
    address: z.string().trim().min(3).max(300),
    instructions: z.string().trim().max(1200),
    sortOrder: z.coerce.number().int().min(-32768).max(32767),
    active: z.enum(["true", "false"]),
  }).safeParse({
    locationId: formData.get("location_id") ?? "",
    collegeId: formData.get("college_id"),
    name: formData.get("name"),
    address: formData.get("address"),
    instructions: formData.get("instructions") ?? "",
    sortOrder: formData.get("sort_order"),
    active: formData.get("is_active"),
  });
  if (!parsed.success) redirect("/admin/pickup?error=pickup");
  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role) || member.profile.suspended_at) {
    redirect("/auth/sign-in?error=session");
  }
  const collegeId = member.profile.role === "super_admin" ? parsed.data.collegeId : member.profile.college_id;
  if (!collegeId) redirect("/admin/pickup?error=pickup");
  const { error } = await member.supabase.rpc("manage_pickup_location", {
    p_location_id: parsed.data.locationId || null,
    p_college_id: collegeId,
    p_name: parsed.data.name,
    p_address: parsed.data.address,
    p_instructions: parsed.data.instructions,
    p_sort_order: parsed.data.sortOrder,
    p_is_active: parsed.data.active === "true",
  });
  redirect(error ? "/admin/pickup?error=pickup" : "/admin/pickup?saved=1");
}
