import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const NITC_COLLEGE_ID = "35b88dad-65f3-4cd6-b44d-c7d2fda7711a";

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
  upi_id?: string | null;
};

export async function getCurrentMember() {
  if (!isSupabaseConfigured()) redirect("/setup");

  const supabase = await createClient();
  let userId: string | null = null;

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (!claimsError && claimsData?.claims?.sub) {
    userId = String(claimsData.claims.sub);
  } else {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData?.user?.id) {
      userId = userData.user.id;
    }
  }

  if (!userId) {
    return { supabase, userId: null, profile: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, handle, phone, bio, college_id, role, verification_status, suspended_at, upi_id")
    .eq("id", userId)
    .maybeSingle();

  return {
    supabase,
    userId,
    profile: error ? null : (data as MemberProfile | null),
  };
}

export async function requireApprovedMember() {
  // 1. Check for real active Supabase authenticated session
  const member = await getCurrentMember();
  if (member.userId && member.profile) {
    if (member.profile.suspended_at || member.profile.verification_status === "suspended") {
      redirect("/auth/suspended");
    }

    let activeProfile = { ...member.profile };

    // Ensure college_id is set to active campus if not already linked
    if (!activeProfile.college_id) {
      activeProfile.college_id = NITC_COLLEGE_ID;
      try {
        await member.supabase
          .from("profiles")
          .update({ college_id: NITC_COLLEGE_ID })
          .eq("id", member.userId);
      } catch {}
    }

    // In local development or once approved, grant full marketplace access
    if (activeProfile.verification_status === "approved" || process.env.NODE_ENV === "development") {
      return {
        supabase: member.supabase,
        userId: member.userId,
        profile: {
          ...activeProfile,
          verification_status: "approved" as const,
        },
      };
    }

    redirect("/verification");
  }

  // 2. Fallback only if no real session exists and dev bypass is enabled (for smoke tests)
  if (process.env.NODE_ENV === "development" && process.env.LOOPEC_DEV_BYPASS_AUTH === "true") {
    const supabase = await createClient();
    const userId = "00000000-0000-4000-8000-000000000001";
    const profile: MemberProfile = {
      id: userId,
      full_name: "Sandep (NITC Member)",
      handle: "sandep-nitc",
      phone: null,
      bio: "NITC Student & Campus Trader",
      college_id: NITC_COLLEGE_ID,
      role: "student",
      verification_status: "approved",
      suspended_at: null,
      upi_id: "sandep@okaxis",
    };
    return { supabase, userId, profile };
  }

  redirect("/auth/sign-in?next=%2Fmarketplace&error=session");
}
