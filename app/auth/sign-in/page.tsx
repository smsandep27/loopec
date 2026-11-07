import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthShell, FormNotice, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authMessage } from "@/lib/auth/messages";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { signIn } from "@/app/auth/actions";

export const instant = false;

export default async function SignInPage({ searchParams }: PageProps<"/auth/sign-in">) {
  const { error, next, password_updated: passwordUpdated } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  const nextPath = typeof next === "string" ? next : "";
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to LOOPEC"
      description="Use the college email address connected to your account."
      footer={<>New to the campus loop? <Link className="font-semibold text-violet-800 hover:text-violet-950" href="/auth/sign-up">Create an account</Link></>}
    >
      <div className="space-y-5">
        {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}
        {passwordUpdated ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your password has been updated. Sign in with the new password.</p> : null}
        {!isSupabaseConfigured() ? <FormNotice>Account setup is not connected yet. <Link className="font-semibold underline" href="/setup">View setup details</Link>.</FormNotice> : (
          <form action={signIn} className="space-y-4">
            <input type="hidden" name="next" value={nextPath} />
            <label className={labelClassName}>
              College email
              <input className={inputClassName} name="email" type="email" autoComplete="email" required />
            </label>
            <label className={labelClassName}>
              Password
              <input className={inputClassName} name="password" type="password" autoComplete="current-password" required />
            </label>
            <div className="flex justify-end">
              <Link className="text-xs font-semibold text-violet-800 hover:text-violet-950" href="/auth/forgot-password">Forgot password?</Link>
            </div>
            <Button className="w-full" size="lg" type="submit">Sign in <ArrowRight size={16} /></Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
