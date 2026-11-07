import Link from "next/link";
import { ArrowLeft, Flag, ShieldAlert } from "lucide-react";
import { AuthShell, FormNotice } from "@/components/auth/auth-shell";
import { authMessage } from "@/lib/auth/messages";
import { getCurrentMember } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { reviewReport } from "@/app/admin/actions";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type Report = { id: string; reporter_id: string; product_id: string | null; reported_user_id: string | null; reason: string; details: string; status: string; created_at: string };
const reasonLabels: Record<string, string> = { prohibited_item: "Prohibited item", misleading_listing: "Misleading listing", safety: "Safety concern", harassment: "Harassment", other: "Other" };

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Community reports" title="Pilot setup is incomplete" description="Report review will be available after the pilot database is connected."><Link href="/setup" className="font-semibold text-violet-800">View setup details</Link></AuthShell>;
  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role) || member.profile.suspended_at) {
    return <AuthShell eyebrow="Restricted area" title="College administrators only" description="Your account does not have access to reports."><Link href="/" className="font-semibold text-violet-800">Return to home</Link></AuthShell>;
  }
  const query = member.supabase.from("reports").select("id, reporter_id, product_id, reported_user_id, reason, details, status, created_at").in("status", ["open", "under_review"]).order("created_at", { ascending: true });
  const { data, error } = await query;
  const reports = (data ?? []) as Report[];
  const userIds = [...new Set(reports.flatMap((report) => [report.reporter_id, report.reported_user_id].filter((id): id is string => Boolean(id))))];
  const productIds = [...new Set(reports.map((report) => report.product_id).filter((id): id is string => Boolean(id)))];
  const [{ data: profileData }, { data: productData }] = await Promise.all([
    userIds.length ? member.supabase.from("profiles").select("id, full_name, handle").in("id", userIds) : Promise.resolve({ data: [] }),
    productIds.length ? member.supabase.from("products").select("id, name, seller_id").in("id", productIds) : Promise.resolve({ data: [] }),
  ]);
  const profiles = new Map(((profileData ?? []) as { id: string; full_name: string; handle: string }[]).map((profile) => [profile.id, profile]));
  const products = new Map(((productData ?? []) as { id: string; name: string; seller_id: string }[]).map((product) => [product.id, product]));
  const errorMessage = errorCode === "review" ? authMessage("report_review") : authMessage(errorCode);

  return (
    <main className="min-h-screen bg-[#f7f6f4] px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/admin" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Admin</span></Link><div className="flex items-center gap-4"><Link className="text-xs font-semibold text-violet-800" href="/admin">Verification queue</Link><form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form></div></header>
      <section className="mx-auto mt-11 max-w-6xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Admin home</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[#e8e5e2] pb-7"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-violet-700"><ShieldAlert size={14} /> Community care</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Member reports</h1><p className="mt-2 text-sm leading-6 text-[#77717e]">Review reports about campus listings and member safety.</p></div><span className="rounded-full border border-[#e8e3ec] bg-white px-4 py-2 text-xs font-semibold text-[#5e5765]">{reports.length} open</span></div>
        <div className="mt-6 space-y-4">{errorMessage ? <FormNotice>{errorMessage}</FormNotice> : null}{params.updated ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Report status updated and recorded in the audit log.</p> : null}{error ? <FormNotice>We could not load reports. Check the schema and admin college scope.</FormNotice> : null}
          {!error && !reports.length ? <div className="rounded-[26px] border border-dashed border-[#d9d2e0] bg-white px-6 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-800"><Flag size={21} /></span><h2 className="mt-4 font-serif text-2xl text-[#28232f]">No open reports</h2><p className="mt-2 text-sm text-[#77717e]">New community reports will appear here.</p></div> : null}
          {reports.map((report) => {
            const reporter = profiles.get(report.reporter_id);
            const reportedUser = report.reported_user_id ? profiles.get(report.reported_user_id) : null;
            const product = report.product_id ? products.get(report.product_id) : null;
            return <article className="grid gap-5 rounded-[24px] border border-[#e8e5e2] bg-white p-5 sm:grid-cols-[minmax(0,1fr)_280px] sm:p-6" key={report.id}>
              <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-semibold text-rose-800">{reasonLabels[report.reason] ?? report.reason}</span><span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-semibold text-violet-800">{report.status.replace("_", " ")}</span><span className="text-[10px] text-[#928b96]">{new Date(report.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span></div><h2 className="mt-3 text-sm font-semibold text-[#383240]">{product?.name ?? (reportedUser ? `Report about ${reportedUser.full_name}` : "Campus safety report")}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#716b77]">{report.details || "No additional detail provided."}</p><p className="mt-3 text-xs text-[#8b8590]">Reported by {reporter?.full_name ?? "Campus member"}{reporter ? ` · @${reporter.handle}` : ""}{reportedUser ? ` · About ${reportedUser.full_name} (@${reportedUser.handle})` : ""}</p>{product ? <Link className="mt-3 inline-flex text-xs font-semibold text-violet-800 hover:text-violet-950" href={`/marketplace/${product.id}`}>View listing</Link> : null}</div>
              <div className="space-y-2"><form action={reviewReport}><input type="hidden" name="report_id" value={report.id} /><input type="hidden" name="decision" value="under_review" /><button className="min-h-10 w-full rounded-full border border-violet-200 text-xs font-semibold text-violet-900 hover:bg-violet-50" type="submit">Keep under review</button></form><form action={reviewReport} className="space-y-2"><input type="hidden" name="report_id" value={report.id} /><input type="hidden" name="decision" value="resolved" /><label className="block text-xs font-semibold text-[#625b6b]">Resolution note <textarea className="mt-1.5 min-h-16 w-full resize-y rounded-xl border border-[#e4e0e8] p-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="moderator_notes" maxLength={2000} /></label><button className="min-h-10 w-full rounded-full bg-violet-950 text-xs font-semibold text-white hover:bg-violet-900" type="submit">Resolve report</button></form><form action={reviewReport}><input type="hidden" name="report_id" value={report.id} /><input type="hidden" name="decision" value="dismissed" /><input type="hidden" name="moderator_notes" value="No policy issue found." /><button className="min-h-10 w-full rounded-full text-xs font-semibold text-[#716a77] hover:bg-[#f8f7f8]" type="submit">Dismiss report</button></form></div>
            </article>;
          })}
        </div>
      </section>
    </main>
  );
}
