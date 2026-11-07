import Link from "next/link";
import { ArrowLeft, BadgeCheck, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { AuthShell, FormNotice } from "@/components/auth/auth-shell";
import { authMessage } from "@/lib/auth/messages";
import { getCurrentMember } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { setMemberSuspension } from "@/app/admin/actions";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type Member = { id: string; full_name: string; handle: string; role: string; verification_status: string; suspended_at: string | null; created_at: string };
const roleNames: Record<string, string> = { student: "Student", faculty: "Faculty", staff: "College staff", college_admin: "College admin", super_admin: "Super admin" };

export default async function AdminMembersPage({ searchParams }: PageProps<"/admin/members">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const searchParam = Array.isArray(params.q) ? params.q[0] : params.q;
  const search = (searchParam ?? "").replace(/[^a-zA-Z0-9 .'-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Member access" title="Pilot setup is incomplete" description="Member management will be available when the pilot database is connected."><Link href="/setup" className="font-semibold text-violet-800">View setup details</Link></AuthShell>;
  const admin = await getCurrentMember();
  if (!admin.userId || !admin.profile || !["college_admin", "super_admin"].includes(admin.profile.role) || admin.profile.suspended_at) {
    return <AuthShell eyebrow="Restricted area" title="College administrators only" description="Your account does not have access to member management."><Link href="/" className="font-semibold text-violet-800">Return to home</Link></AuthShell>;
  }
  let query = admin.supabase.from("profiles").select("id, full_name, handle, role, verification_status, suspended_at, created_at").order("created_at", { ascending: false }).limit(200);
  if (search) query = query.ilike("full_name", `%${search}%`);
  if (admin.profile.role !== "super_admin" && admin.profile.college_id) query = query.eq("college_id", admin.profile.college_id);
  const { data, error } = await query;
  const members = (data ?? []) as Member[];

  return (
    <main className="min-h-screen bg-[#f7f6f4] px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/admin" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Admin</span></Link><div className="flex items-center gap-4"><Link className="text-xs font-semibold text-violet-800" href="/admin">Verification queue</Link><form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form></div></header>
      <section className="mx-auto mt-11 max-w-6xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Admin home</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[#e8e5e2] pb-7"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-violet-700"><ShieldCheck size={14} /> Campus administration</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Member access</h1><p className="mt-2 text-sm leading-6 text-[#77717e]">Review member status and suspend or reinstate ordinary campus accounts.</p></div><span className="rounded-full border border-[#e8e3ec] bg-white px-4 py-2 text-xs font-semibold text-[#5e5765]">{members.length} members</span></div>
        <form className="mt-5 flex gap-2 rounded-[20px] border border-[#e8e5e2] bg-white p-3"><label className="flex-1"><span className="sr-only">Search by member name</span><input className="min-h-11 w-full rounded-full bg-[#f8f7f8] px-4 text-sm outline-none focus:ring-4 focus:ring-violet-100" name="q" maxLength={80} defaultValue={search} placeholder="Search members by name" /></label><button className="min-h-11 rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" type="submit">Search</button></form>
        <div className="mt-5 space-y-4">{errorCode ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}{params.suspended ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">Member suspended. This action is recorded in the audit log.</p> : null}{params.reinstated ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Member reinstated.</p> : null}{error ? <FormNotice>We could not load members. Check the schema and admin college scope.</FormNotice> : null}
          {members.map((member) => {
            const protectedRole = member.role === "college_admin" || member.role === "super_admin";
            const suspended = Boolean(member.suspended_at) || member.verification_status === "suspended";
            return <article className="grid gap-4 rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)] sm:items-center sm:p-6" key={member.id}>
              <div className="flex min-w-0 items-center gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${suspended ? "bg-amber-50 text-amber-800" : "bg-violet-50 text-violet-800"}`}>{suspended ? <ShieldAlert size={19} /> : <UserRound size={19} />}</span><span className="min-w-0"><b className="flex items-center gap-1.5 truncate text-sm text-[#383240]">{member.full_name}{member.verification_status === "approved" && !suspended ? <BadgeCheck size={14} className="shrink-0 text-violet-700" /> : null}</b><small className="mt-1 block truncate text-xs text-[#817a87]">@{member.handle} · {roleNames[member.role] ?? member.role}</small><small className="mt-1 block text-[10px] text-[#958e99]">{suspended ? "Suspended" : member.verification_status.replace("_", " ")} · Joined {new Date(member.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</small></span></div>
              {protectedRole || member.id === admin.userId ? <p className="text-xs leading-5 text-[#89828e]">Admin access changes require an owner-level review.</p> : suspended ? <form action={setMemberSuspension}><input type="hidden" name="user_id" value={member.id} /><input type="hidden" name="suspend" value="false" /><button className="min-h-10 rounded-full border border-emerald-200 px-4 text-xs font-semibold text-emerald-800 hover:bg-emerald-50" type="submit">Reinstate member</button></form> : <form action={setMemberSuspension} className="flex flex-col gap-2"><input type="hidden" name="user_id" value={member.id} /><input type="hidden" name="suspend" value="true" /><label className="text-xs font-semibold text-[#625b6b]">Reason for suspension<input className="mt-1.5 min-h-10 w-full rounded-xl border border-[#e4e0e8] px-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="reason" required minLength={5} maxLength={1000} /></label><button className="min-h-10 self-start rounded-full border border-rose-200 px-4 text-xs font-semibold text-rose-800 hover:bg-rose-50" type="submit">Suspend account</button></form>}
            </article>;
          })}
          {!error && members.length === 0 ? <p className="rounded-2xl border border-dashed border-[#d9d2e0] bg-white px-5 py-12 text-center text-sm text-[#77717e]">No members match that search.</p> : null}
        </div>
      </section>
    </main>
  );
}
