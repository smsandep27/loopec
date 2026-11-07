import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type MemberProfile = {
  id: string;
  full_name: string;
  handle: string;
  phone: string | null;
  bio: string | null;
  college_id: string | null;
  role: "student" | "faculty" | "staff" | "college_admin" | "super_admin";
  verification_status:
    | "not_submitted"
    | "pending"
    | "approved"
    | "rejected"
    | "suspended";
  suspended_at: string | null;
};

export async function getCurrentMember() {
  if (!isSupabaseConfigured()) redirect("/setup");

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    return { supabase, userId: null, profile: null };
  }

  const userId = String(claimsData.claims.sub);
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, handle, phone, bio, college_id, role, verification_status, suspended_at")
    .eq("id", userId)
    .maybeSingle();

  return {
    supabase,
    userId,
    profile: error ? null : (data as MemberProfile | null),
  };
}

export async function requireApprovedMember() {
  const member = await getCurrentMember();
  if (!member.userId || !member.profile) {
    redirect("/auth/sign-in?next=%2Fmarketplace&error=session");
  }
  if (member.profile.suspended_at || member.profile.verification_status === "suspended") {
    redirect("/auth/suspended");
  }
  if (member.profile.verification_status !== "approved") {
    redirect("/verification");
  }
  return member as typeof member & { profile: MemberProfile; userId: string };
}
