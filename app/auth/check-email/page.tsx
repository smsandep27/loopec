import Link from "next/link";
import { AuthShell, FormNotice, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authMessage } from "@/lib/auth/messages";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resendConfirmation } from "@/app/auth/actions";

export const instant = false;

export default async function CheckEmailPage({ searchParams }: PageProps<"/auth/check-email">) {
  const { error, resent } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  return (
    <AuthShell
      eyebrow="Check your inbox"
      title="Confirm your college email"
      description="Open the confirmation link we sent to your college inbox. It returns you to LOOPEC so you can submit your ID for review."
      footer={<Link className="font-semibold text-violet-800 hover:text-violet-950" href="/auth/sign-in">Return to sign in</Link>}
    >
      <div className="space-y-5">
        {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}
        {resent ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">If the account can receive a confirmation link, a fresh email is on its way.</p> : null}
        {isSupabaseConfigured() ? (
          <form action={resendConfirmation} className="space-y-4">
            <label className={labelClassName}>
              Resend confirmation email
              <input className={inputClassName} name="email" type="email" autoComplete="email" required />
            </label>
            <Button className="w-full" variant="secondary" type="submit">Send a new link</Button>
          </form>
        ) : null}
      </div>
    </AuthShell>
  );
}
