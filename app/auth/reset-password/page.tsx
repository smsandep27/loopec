import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, FormNotice, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authMessage } from "@/lib/auth/messages";
import { getCurrentMember } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updatePassword } from "@/app/auth/actions";

export const instant = false;

export default async function ResetPasswordPage({ searchParams }: PageProps<"/auth/reset-password">) {
  const { error } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  if (isSupabaseConfigured()) {
    const member = await getCurrentMember();
    if (!member.userId) redirect("/auth/sign-in?error=session");
  }
  return (
    <AuthShell
      eyebrow="Choose a new password"
      title="Update your password"
      description="Use at least 12 characters. The reset link is valid for a limited time."
      footer={<Link className="font-semibold text-violet-800 hover:text-violet-950" href="/auth/sign-in">Back to sign in</Link>}
    >
      <div className="space-y-5">
        {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}
        {isSupabaseConfigured() ? (
          <form action={updatePassword} className="space-y-4">
            <label className={labelClassName}>
              New password
              <input className={inputClassName} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
            </label>
            <label className={labelClassName}>
              Confirm new password
              <input className={inputClassName} name="password_confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
            </label>
            <Button className="w-full" type="submit">Save new password</Button>
          </form>
        ) : <FormNotice>Account setup is not connected yet. <Link className="font-semibold underline" href="/setup">View setup details</Link>.</FormNotice>}
      </div>
    </AuthShell>
  );
}
