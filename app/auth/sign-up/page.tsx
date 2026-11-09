import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AuthShell, FormNotice, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authMessage } from "@/lib/auth/messages";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { signUp } from "@/app/auth/actions";

export const instant = false;

export default async function SignUpPage({ searchParams }: PageProps<"/auth/sign-up">) {
  if (process.env.NODE_ENV === "development" && process.env.LOOPEC_DEV_BYPASS_AUTH === "true") {
    redirect("/marketplace");
  }
  const { error } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  let colleges: { id: string; name: string; email_domains: string[] }[] = [];
  let collegeLoadError = false;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error: loadError } = await supabase
      .from("colleges")
      .select("id, name, email_domains")
      .eq("is_active", true)
      .order("name");
    collegeLoadError = Boolean(loadError);
    if (!loadError) colleges = (data ?? []) as typeof colleges;
  }

  return (
    <AuthShell
      eyebrow="Join your campus"
      title="Create your account"
      description="Use your college email to begin. We’ll confirm the email before you submit your campus ID for review."
      footer={<>Already part of LOOPEC? <Link className="font-semibold text-violet-800 hover:text-violet-950" href="/auth/sign-in">Sign in</Link></>}
    >
      <div className="space-y-5">
        {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}
        {!isSupabaseConfigured() ? (
          <FormNotice>Account setup is not connected yet. <Link className="font-semibold underline" href="/setup">View setup details</Link>.</FormNotice>
        ) : collegeLoadError ? (
          <FormNotice>We could not load the college list from Supabase. Confirm the migration is applied and the public schema is enabled in the Data API, then try again. <Link className="font-semibold underline" href="/setup">View setup details</Link>.</FormNotice>
        ) : colleges.length === 0 ? (
          <div className="space-y-4 rounded-2xl bg-violet-50 p-5 text-sm leading-6 text-violet-950">
            <p>Your pilot college is not configured yet. Registration opens after an administrator adds the approved college email domains.</p>
            <Link className="inline-flex items-center gap-2 font-semibold" href="/setup">View pilot setup <ArrowRight size={15} /></Link>
          </div>
        ) : (
          <form action={signUp} className="space-y-4">
            <label className={labelClassName}>
              Full name
              <input className={inputClassName} name="full_name" autoComplete="name" minLength={2} maxLength={120} required />
            </label>
            <label className={labelClassName}>
              College email
              <input className={inputClassName} name="email" type="email" autoComplete="email" required />
            </label>
            <label className={labelClassName}>
              College
              <select className={inputClassName} name="college_id" required defaultValue="">
                <option value="" disabled>Select your college</option>
                {colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
              </select>
            </label>
            <label className={labelClassName}>
              Password
              <input className={inputClassName} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
              <span className="mt-1.5 block text-xs font-normal text-[#87818c]">Use at least 12 characters.</span>
            </label>
            <Button className="w-full" size="lg" type="submit">Create account <ArrowRight size={16} /></Button>
            <p className="text-center text-xs leading-5 text-[#8b8590]">By joining, you agree to follow the community rules. Account access begins after your college identity is approved.</p>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
