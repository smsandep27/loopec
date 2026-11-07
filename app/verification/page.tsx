import Link from "next/link";
import { Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import { AuthShell, FormNotice, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getCurrentMember } from "@/lib/auth/member";
import { authMessage } from "@/lib/auth/messages";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { signOut } from "@/app/auth/actions";
import { submitVerification } from "@/app/auth/actions";

export const instant = false;

export default async function VerificationPage({ searchParams }: PageProps<"/verification">) {
  const { error, submitted } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  if (!isSupabaseConfigured()) {
    return (
      <AuthShell eyebrow="Member verification" title="Connect your campus" description="College identity checks will be available when the pilot database is configured.">
        <Link className="inline-flex min-h-12 items-center rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" href="/setup">View setup</Link>
      </AuthShell>
    );
  }

  const member = await getCurrentMember();
  if (!member.userId) {
    return (
      <AuthShell eyebrow="Member verification" title="Sign in to continue" description="Sign in after confirming your college email to submit your campus ID for review.">
        <Link className="inline-flex min-h-12 items-center rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" href="/auth/sign-in">Sign in to LOOPEC</Link>
      </AuthShell>
    );
  }
  if (member.profile?.suspended_at || member.profile?.verification_status === "suspended") {
    return (
      <AuthShell eyebrow="Account access" title="Please contact your college admin" description="This account cannot submit verification or access the marketplace right now.">
        <Link className="font-semibold text-violet-800" href="/auth/suspended">More about account access</Link>
      </AuthShell>
    );
  }
  if (member.profile?.verification_status === "approved") {
    return (
      <AuthShell eyebrow="Identity confirmed" title="You’re in the campus loop" description="Your college membership is approved. You can now access marketplace listings and member features.">
        <Link className="inline-flex min-h-12 items-center rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" href="/marketplace">Open marketplace</Link>
      </AuthShell>
    );
  }

  const [{ data: collegeData }, { data: verificationData }] = await Promise.all([
    member.supabase.from("colleges").select("id, name, email_domains").eq("is_active", true).order("name"),
    member.supabase.from("user_verifications").select("status, rejection_reason, created_at").eq("user_id", member.userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const colleges = (collegeData ?? []) as { id: string; name: string; email_domains: string[] }[];
  const latest = verificationData as { status: string; rejection_reason: string | null; created_at: string } | null;
  const pending = member.profile?.verification_status === "pending" || latest?.status === "pending";

  return (
    <AuthShell
      eyebrow="Member verification"
      title={pending ? "Your details are under review" : "Verify your campus identity"}
      description={pending ? "A college administrator will review your submission. Your ID document is stored privately and can only be seen by you and authorized college admins." : "Confirm the college linked to your email and upload a current campus ID. Approved members can both buy and sell with one account."}
      footer={<Link className="font-semibold text-violet-800 hover:text-violet-950" href="/">Return to LOOPEC</Link>}
    >
      {pending ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <Clock3 className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
            <div><p className="font-semibold">Review pending</p><p className="mt-1 text-sm leading-5">You can sign in and check this status while you wait. Marketplace access opens after approval.</p></div>
          </div>
          <div className="flex items-center gap-4">
            <Link className="inline-flex min-h-11 items-center rounded-full border border-violet-200 px-5 text-sm font-semibold text-violet-950" href="/">Back to home</Link>
            <form action={signOut}><button className="text-sm font-semibold text-[#77717e] hover:text-violet-950" type="submit">Sign out</button></form>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {authMessage(errorCode) ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}
          {submitted ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your verification request was submitted. We’ll update this page when the college admin reviews it.</p> : null}
          {latest?.status === "rejected" && latest.rejection_reason ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950">Admin feedback: {latest.rejection_reason}</p> : null}
          {colleges.length === 0 ? (
            <p className="rounded-2xl bg-violet-50 p-4 text-sm leading-6 text-violet-950">The pilot college has not been configured yet. Ask your LOOPEC administrator to add it before submitting identity details.</p>
          ) : (
            <form action={submitVerification} className="space-y-4" encType="multipart/form-data">
              <label className={labelClassName}>
                College
                <select className={inputClassName} name="college_id" required defaultValue={member.profile?.college_id ?? ""}>
                  <option value="" disabled>Select your college</option>
                  {colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
                </select>
              </label>
              <label className={labelClassName}>
                Your campus role
                <select className={inputClassName} name="requested_role" required defaultValue="student">
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="staff">College staff</option>
                </select>
              </label>
              <label className={labelClassName}>
                College ID document
                <input className={`${inputClassName} file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-950`} name="college_id_document" type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" required />
                <span className="mt-1.5 block text-xs font-normal leading-5 text-[#87818c]">PDF, JPG or PNG, up to 5 MB. Your document is private and only shared with authorized college administrators.</span>
              </label>
              <div className="flex gap-3 rounded-2xl bg-[#f6f3fa] p-4 text-xs leading-5 text-[#625b6b]">
                <ShieldCheck className="shrink-0 text-violet-800" size={17} aria-hidden="true" />
                <p>We use the confirmed email address on your account to check that it matches the selected college domain. The uploaded file is not publicly accessible.</p>
              </div>
              <Button className="w-full" size="lg" type="submit"><FileCheck2 size={16} /> Submit for review</Button>
            </form>
          )}
        </div>
      )}
    </AuthShell>
  );
}
