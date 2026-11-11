import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthShell, FormNotice } from "@/components/auth/auth-shell";
import { CollegeTrustShowcase } from "@/components/auth/college-trust-showcase";
import { CollegeSignUpForm } from "@/components/auth/college-sign-up-form";
import { authMessage } from "@/lib/auth/messages";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function SignUpPage({ searchParams }: PageProps<"/auth/sign-up">) {
  const { error } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;

  let colleges: { id: string; name: string; email_domains: string[] }[] = [];
  let collegeLoadError = false;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data, error: loadError } = await supabase
        .from("colleges")
        .select("id, name, email_domains")
        .eq("is_active", true)
        .order("name");
      collegeLoadError = Boolean(loadError);
      if (!loadError && data) {
        colleges = data as typeof colleges;
      }
    } catch {
      collegeLoadError = true;
    }
  }

  // Fallback if DB list is empty during initial setup
  if (colleges.length === 0 && !collegeLoadError) {
    colleges = [
      {
        id: "35b88dad-65f3-4cd6-b44d-c7d2fda7711a",
        name: "National Institute of Technology Calicut",
        email_domains: ["nitc.ac.in"],
      },
    ];
  }

  const singleCollege = colleges.length > 0 ? colleges[0] : null;
  const primaryDomain = singleCollege?.email_domains?.[0] ?? "nitc.ac.in";

  return (
    <AuthShell
      eyebrow="Join your campus"
      title="Create your account"
      description="Use your college email to begin. We’ll confirm the email before you submit your campus ID for review."
      campusBadge="NITC Registration Open"
      sidebar={
        <CollegeTrustShowcase
          collegeName={singleCollege?.name ?? "National Institute of Technology Calicut"}
          collegeDomain={primaryDomain}
        />
      }
      footer={
        <>
          Already part of LOOPEC?{" "}
          <Link
            className="font-semibold text-violet-800 hover:text-violet-950 underline decoration-violet-300 underline-offset-4"
            href="/auth/sign-in"
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}

        {!isSupabaseConfigured() ? (
          <FormNotice>
            Account setup is not connected yet.{" "}
            <Link className="font-semibold underline" href="/setup">
              View setup details
            </Link>
            .
          </FormNotice>
        ) : collegeLoadError ? (
          <FormNotice>
            We could not load the college list from Supabase. Confirm the migration is applied and the public schema is enabled in the Data API, then try again.{" "}
            <Link className="font-semibold underline" href="/setup">
              View setup details
            </Link>
            .
          </FormNotice>
        ) : colleges.length === 0 ? (
          <div className="space-y-4 rounded-2xl bg-violet-50 p-5 text-sm leading-6 text-violet-950">
            <p>
              Your pilot college is not configured yet. Registration opens after an administrator adds the approved college email domains.
            </p>
            <Link className="inline-flex items-center gap-2 font-semibold" href="/setup">
              View pilot setup <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <CollegeSignUpForm colleges={colleges} />
        )}
      </div>
    </AuthShell>
  );
}
