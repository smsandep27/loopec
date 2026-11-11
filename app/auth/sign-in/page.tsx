import Link from "next/link";
import { AuthShell, FormNotice } from "@/components/auth/auth-shell";
import { CollegeTrustShowcase } from "@/components/auth/college-trust-showcase";
import { CollegeSignInForm } from "@/components/auth/college-sign-in-form";
import { authMessage } from "@/lib/auth/messages";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function SignInPage({ searchParams }: PageProps<"/auth/sign-in">) {
  const { error, next, password_updated: passwordUpdated } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  const nextPath = typeof next === "string" ? next : "";

  let collegeName = "National Institute of Technology Calicut";
  let collegeDomain = "nitc.ac.in";

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data: colleges } = await supabase
        .from("colleges")
        .select("name, email_domains")
        .eq("is_active", true)
        .limit(1);

      if (colleges && colleges.length > 0) {
        collegeName = colleges[0].name;
        if (colleges[0].email_domains && colleges[0].email_domains.length > 0) {
          collegeDomain = colleges[0].email_domains[0];
        }
      }
    } catch {
      // Use defaults if query fails
    }
  }

  return (
    <AuthShell
      eyebrow="Campus Authentication"
      title="Sign in to LOOPEC"
      description="Use the college email address connected to your account."
      campusBadge="NITC Exclusive Portal"
      sidebar={
        <CollegeTrustShowcase
          collegeName={collegeName}
          collegeDomain={collegeDomain}
        />
      }
      footer={
        <>
          New to the campus loop?{" "}
          <Link
            className="font-semibold text-violet-800 hover:text-violet-950 underline decoration-violet-300 underline-offset-4"
            href="/auth/sign-up"
          >
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}

        {passwordUpdated ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Your password has been updated. Sign in with the new password.
          </p>
        ) : null}

        {!isSupabaseConfigured() ? (
          <FormNotice>
            Account setup is not connected yet.{" "}
            <Link className="font-semibold underline" href="/setup">
              View setup details
            </Link>
            .
          </FormNotice>
        ) : (
          <CollegeSignInForm
            nextPath={nextPath}
            collegeName={collegeName}
            collegeDomain={collegeDomain}
          />
        )}
      </div>
    </AuthShell>
  );
}
