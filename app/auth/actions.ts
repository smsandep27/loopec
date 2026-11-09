"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(12).max(128),
  collegeId: z.uuid(),
});

function siteOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredOrigin) return "http://localhost:3000";
  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/marketplace";
}

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/setup");

  const parsed = signUpSchema.safeParse({
    fullName: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    collegeId: formData.get("college_id"),
  });
  if (!parsed.success) redirect("/auth/sign-up?error=invalid");

  const { fullName, email, password, collegeId } = parsed.data;
  const domain = email.split("@").at(-1)?.toLowerCase();
  const supabase = await createClient();
  const { data: college } = await supabase
    .from("colleges")
    .select("id, email_domains")
    .eq("id", collegeId)
    .eq("is_active", true)
    .maybeSingle();

  const domains = (college?.email_domains ?? []) as string[];
  if (!college || !domain || !domains.some((item) => item.trim().toLowerCase() === domain)) {
    redirect("/auth/sign-up?error=domain");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${siteOrigin()}/auth/callback?next=%2Fverification`,
    },
  });
  if (error) redirect("/auth/sign-up?error=sign_up");
  (await cookies()).set("loopec_pending_email", email, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/auth/check-email", maxAge: 15 * 60 });
  redirect("/auth/check-email");
}

export async function signIn(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/setup");

  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const password = z.string().min(1).safeParse(formData.get("password"));
  if (!email.success || !password.success) redirect("/auth/sign-in?error=invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });
  if (error) {
    if (error.code === "email_not_confirmed" || error.message.toLowerCase().includes("email not confirmed")) {
      (await cookies()).set("loopec_pending_email", email.data, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/auth/check-email", maxAge: 15 * 60 });
      redirect("/auth/check-email?error=unconfirmed");
    }
    redirect("/auth/sign-in?error=sign_in");
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/auth/sign-in?error=sign_in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("verification_status, suspended_at")
    .eq("id", String(userId))
    .maybeSingle();

  if (profile?.suspended_at || profile?.verification_status === "suspended") {
    redirect("/auth/suspended");
  }
  if (profile?.verification_status === "approved") redirect(safeNext(String(formData.get("next") ?? "")));
  redirect("/verification");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) redirect("/auth/forgot-password?error=invalid");

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteOrigin()}/auth/callback?next=%2Fauth%2Freset-password`,
  });
  // Keep the result the same whether the address belongs to an account or not.
  redirect("/auth/forgot-password?sent=1");
}

export async function resendConfirmation(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) redirect("/auth/check-email?error=invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: {
      emailRedirectTo: `${siteOrigin()}/auth/callback?next=%2Fverification`,
    },
  });
  if (error) redirect("/auth/check-email?error=email_send");
  redirect("/auth/check-email?resent=1");
}

export async function updatePassword(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const password = z.string().min(12).max(128).safeParse(formData.get("password"));
  const confirmation = String(formData.get("password_confirmation") ?? "");
  if (!password.success || password.data !== confirmation) {
    redirect("/auth/reset-password?error=invalid");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in?error=session");

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect("/auth/reset-password?error=invalid");
  redirect("/auth/sign-in?password_updated=1");
}

const verificationSchema = z.object({
  collegeId: z.uuid(),
  requestedRole: z.enum(["student", "faculty", "staff"]),
});

function detectDocumentType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") {
    return { mime: "application/pdf", extension: "pdf" };
  }
  return null;
}

export async function submitVerification(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const parsed = verificationSchema.safeParse({
    collegeId: formData.get("college_id"),
    requestedRole: formData.get("requested_role"),
  });
  const document = formData.get("college_id_document");
  if (!parsed.success || !(document instanceof File) || document.size < 1 || document.size > 5 * 1024 * 1024) {
    redirect("/verification?error=upload");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/auth/sign-in?error=session");

  const { data: accountData, error: accountError } = await supabase.auth.getUser();
  const confirmedEmail = accountData.user?.email?.trim().toLowerCase();
  if (accountError || !confirmedEmail || !accountData.user?.email_confirmed_at) {
    redirect("/auth/check-email");
  }
  const domain = confirmedEmail.split("@").at(-1)?.toLowerCase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("verification_status, suspended_at")
    .eq("id", String(userId))
    .maybeSingle();
  if (profile?.suspended_at || profile?.verification_status === "suspended") redirect("/auth/suspended");
  if (profile?.verification_status === "approved") redirect("/marketplace");
  if (profile?.verification_status === "pending") redirect("/verification?error=already_pending");

  const { data: college } = await supabase
    .from("colleges")
    .select("id, email_domains")
    .eq("id", parsed.data.collegeId)
    .eq("is_active", true)
    .maybeSingle();
  const domains = (college?.email_domains ?? []) as string[];
  if (!college || !domain || !domains.some((item) => item.trim().toLowerCase() === domain)) {
    redirect("/verification?error=domain");
  }

  const header = new Uint8Array(await document.slice(0, 8).arrayBuffer());
  const fileType = detectDocumentType(header);
  if (!fileType) redirect("/verification?error=upload");

  const path = `${String(userId)}/${crypto.randomUUID()}.${fileType.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("verification-documents")
    .upload(path, document, {
      contentType: fileType.mime,
      cacheControl: "0",
      upsert: false,
    });
  if (uploadError) redirect(`/verification?error=${uploadError.message.includes("rate_limit_exceeded") ? "rate_limit" : "upload"}`);

  const { error: insertError } = await supabase.from("user_verifications").insert({
    user_id: String(userId),
    college_id: college.id,
    requested_role: parsed.data.requestedRole,
    college_email: confirmedEmail,
    id_document_path: path,
  });

  if (insertError) {
    await supabase.storage.from("verification-documents").remove([path]);
    if (insertError.code === "23505") redirect("/verification?error=already_pending");
    if (insertError.code === "P0001" && insertError.message.includes("rate_limit_exceeded")) redirect("/verification?error=rate_limit");
    redirect("/verification?error=upload");
  }

  redirect("/verification?submitted=1");
}
