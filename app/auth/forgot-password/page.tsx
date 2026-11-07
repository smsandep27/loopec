import Link from "next/link";
import { AuthShell, FormNotice, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authMessage } from "@/lib/auth/messages";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { requestPasswordReset } from "@/app/auth/actions";

export const instant = false;

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/auth/forgot-password">) {
  const { error, sent } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter the college email on your LOOPEC account. We’ll send a secure password reset link if it can receive one."
      footer={<Link className="font-semibold text-violet-800 hover:text-violet-950" href="/auth/sign-in">Back to sign in</Link>}
    >
      <div className="space-y-5">
        {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}
        {sent ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-800">If that account exists, a reset link is on its way. Check your inbox and spam folder.</p> : null}
        {isSupabaseConfigured() ? (
          <form action={requestPasswordReset} className="space-y-4">
            <label className={labelClassName}>
              College email
              <input className={inputClassName} name="email" type="email" autoComplete="email" required />
            </label>
            <Button className="w-full" variant="primary" type="submit">Send reset link</Button>
          </form>
        ) : <FormNotice>Account setup is not connected yet. <Link className="font-semibold underline" href="/setup">View setup details</Link>.</FormNotice>}
      </div>
    </AuthShell>
  );
}
