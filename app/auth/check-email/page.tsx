import Link from "next/link";
import { cookies } from "next/headers";
import { AuthShell, FormNotice, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authMessage } from "@/lib/auth/messages";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resendConfirmation } from "@/app/auth/actions";

export const instant = false;

export default async function CheckEmailPage({ searchParams }: PageProps<"/auth/check-email">) {
  const { error, resent } = await searchParams;
  const pendingEmail = (await cookies()).get("loopec_pending_email")?.value ?? "";
  const errorCode = Array.isArray(error) ? error[0] : error;
  return (
    <AuthShell
      eyebrow="Check your inbox"
      title="Confirm your college email"
      description="Open the confirmation link we sent to your college inbox. It will confirm your email and continue to verification. Check Spam if it’s missing."
      footer={<Link className="font-semibold text-violet-800 hover:text-violet-950" href="/auth/sign-in">Return to sign in</Link>}
    >
      <div className="space-y-5">
        {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}
        {resent ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">If the account can receive a confirmation link, a fresh email is on its way.</p> : null}
        {isSupabaseConfigured() ? (
          <form action={resendConfirmation} className="space-y-4">
            <label className={labelClassName}>College email<input className={inputClassName} name="email" type="email" autoComplete="email" defaultValue={pendingEmail} required /></label>
            <Button className="w-full" variant="secondary" type="submit">Resend confirmation link</Button>
          </form>
        ) : null}
      </div>
    </AuthShell>
  );
}
