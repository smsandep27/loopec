"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function updateProfile(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const parsed = z.object({
    fullName: z.string().trim().min(2).max(120),
    handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,31}$/),
    phone: z.string().trim().max(30),
    bio: z.string().trim().max(500),
  }).safeParse({
    fullName: formData.get("full_name"),
    handle: formData.get("handle"),
    phone: formData.get("phone") ?? "",
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) redirect("/profile?error=invalid");

  const member = await getCurrentMember();
  if (!member.userId || !member.profile || member.profile.suspended_at) {
    redirect("/auth/sign-in?error=session");
  }

  const { error } = await member.supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      handle: parsed.data.handle,
      phone: parsed.data.phone || null,
      bio: parsed.data.bio || null,
    })
    .eq("id", member.userId);

  if (error) {
    redirect(error.code === "23505" ? "/profile?error=handle" : "/profile?error=invalid");
  }
  redirect("/profile?saved=1");
}
