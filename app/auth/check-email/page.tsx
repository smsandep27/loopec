import Link from "next/link";
import { cookies } from "next/headers";
import { AuthShell, FormNotice } from "@/components/auth/auth-shell";
import { OtpVerificationForm } from "@/components/auth/otp-verification-form";
import { CollegeTrustShowcase } from "@/components/auth/college-trust-showcase";
import { authMessage } from "@/lib/auth/messages";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const instant = false;

export default async function CheckEmailPage({ searchParams }: PageProps<"/auth/check-email">) {
  const { error, resent, email } = await searchParams;
  const cookieEmail = (await cookies()).get("loopec_pending_email")?.value ?? "";
  const queryEmail = typeof email === "string" ? email : "";
  const pendingEmail = queryEmail || cookieEmail;
  const errorCode = Array.isArray(error) ? error[0] : error;

  return (
    <AuthShell
      eyebrow="Campus Verification"
      title="Verify your college email"
      description="Enter the 6-digit OTP code sent to your official NIT Calicut email to verify your student/faculty identity."
      campusBadge="NITC Verification"
      sidebar={
        <CollegeTrustShowcase
          collegeName="National Institute of Technology Calicut"
          collegeDomain="nitc.ac.in"
        />
      }
      footer={
        <Link
          className="font-semibold text-violet-800 hover:text-violet-950 underline decoration-violet-300 underline-offset-4"
          href="/auth/sign-in"
        >
          Return to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}

        {resent ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            A fresh 6-digit OTP verification code has been dispatched to your college inbox.
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
          <OtpVerificationForm initialEmail={pendingEmail} />
        )}
      </div>
    </AuthShell>
  );
}
