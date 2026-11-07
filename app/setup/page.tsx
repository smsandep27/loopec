import Link from "next/link";
import { AuthShell, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function SetupPage() {
  return (
    <AuthShell
      eyebrow="Pilot setup"
      title={isSupabaseConfigured() ? "One more setup step" : "LOOPEC is getting ready"}
      description="Connect the pilot Supabase project and configure its college email domains before members can create accounts."
    >
      {isSupabaseConfigured() ? (
        <div className="space-y-4">
          <p className="rounded-2xl bg-violet-50 p-4 text-sm leading-6 text-violet-950">
            Supabase is configured. Apply the initial migration, then run <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">supabase/seeds/nit_calicut.sql</code> in the Supabase SQL Editor. That adds National Institute of Technology Calicut with its institutional <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">nitc.ac.in</code> email domain.
          </p>
          <p className="text-xs leading-5 text-[#7b7482]">The NITC pilot seed is configured for student, faculty, and staff addresses ending in <code>nitc.ac.in</code>.</p>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" href="/auth/sign-up">
            Continue to registration
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[#6e6875]">Add these public project settings to <code className="rounded bg-[#f2eff5] px-1.5 py-1 text-xs">.env.local</code> to enable accounts:</p>
          <div className="space-y-4">
            <label className={labelClassName}>Supabase project URL<input className={inputClassName} readOnly value="NEXT_PUBLIC_SUPABASE_URL=" /></label>
            <label className={labelClassName}>Supabase publishable key<input className={inputClassName} readOnly value="NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=" /></label>
          </div>
          <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">The database migration is ready in the repository, but should only be applied to the selected pilot project.</p>
        </div>
      )}
    </AuthShell>
  );
}
