import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { AuthShell, FormNotice, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authMessage } from "@/lib/auth/messages";
import { getCurrentMember } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { savePickupLocation } from "@/app/admin/actions";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type College = { id: string; name: string };
type PickupLocation = {
  id: string;
  college_id: string;
  name: string;
  address: string;
  instructions: string;
  sort_order: number;
  is_active: boolean;
};

export default async function AdminPickupPage({ searchParams }: PageProps<"/admin/pickup">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Campus pickup" title="Pilot setup is incomplete" description="Pickup point management will be available when the pilot database is connected."><Link href="/setup" className="font-semibold text-violet-800">View setup details</Link></AuthShell>;
  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role) || member.profile.suspended_at) {
    return <AuthShell eyebrow="Restricted area" title="Administrator access only" description="Campus pickup points can only be managed by college administrators."><Link href="/admin" className="font-semibold text-violet-800">Return to admin</Link></AuthShell>;
  }
  const isSuperAdmin = member.profile.role === "super_admin";
  let locationsQuery = member.supabase
    .from("pickup_locations")
    .select("id, college_id, name, address, instructions, sort_order, is_active")
    .order("sort_order");
  if (!isSuperAdmin && member.profile.college_id) locationsQuery = locationsQuery.eq("college_id", member.profile.college_id);
  const [{ data: locationData }, { data: collegeData }] = await Promise.all([
    locationsQuery,
    isSuperAdmin
      ? member.supabase.from("colleges").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);
  const locations = (locationData ?? []) as PickupLocation[];
  const colleges = (collegeData ?? []) as College[];
  const collegeById = new Map(colleges.map((college) => [college.id, college.name]));
  const collegeId = isSuperAdmin ? colleges[0]?.id ?? "" : member.profile.college_id ?? "";

  return (
    <main className="min-h-screen bg-[#f7f6f4] px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/admin" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Admin</span></Link><form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form></header>
      <section className="mx-auto mt-11 max-w-5xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Admin home</Link>
        <div className="mt-5 border-b border-[#e8e5e2] pb-7"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-violet-700"><MapPin size={14} /> Campus operations</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Pickup points</h1><p className="mt-2 text-sm leading-6 text-[#77717e]">Add only locations approved for campus exchanges. Every change is recorded in the admin audit log.</p></div>
        <div className="mt-6 space-y-5">
          {errorCode ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}
          {params.saved ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Pickup point saved.</p> : null}
          {locations.length ? <div className="space-y-4">{locations.map((location) => <form action={savePickupLocation} key={location.id} className="grid gap-3 rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:grid-cols-2 sm:p-6">
            <input type="hidden" name="location_id" value={location.id} />
            {isSuperAdmin ? <label className={labelClassName}>College<select className={inputClassName} name="college_id" defaultValue={location.college_id} required>{colleges.map((college) => <option value={college.id} key={college.id}>{college.name}</option>)}</select></label> : <input type="hidden" name="college_id" value={location.college_id} />}
            <label className={labelClassName}>Location name<input className={inputClassName} name="name" defaultValue={location.name} minLength={2} maxLength={120} required /></label>
            {isSuperAdmin ? <p className="self-end text-xs text-[#817a87]">{collegeById.get(location.college_id) ?? "College"}</p> : null}
            <label className={`${labelClassName} ${isSuperAdmin ? "sm:col-span-2" : "sm:col-span-2"}`}>Address / meeting point<input className={inputClassName} name="address" defaultValue={location.address} minLength={3} maxLength={300} required /></label>
            <label className="block text-xs font-semibold text-[#625b6b] sm:col-span-2">Pickup instructions<textarea className={`${inputClassName} min-h-20 resize-y py-3`} name="instructions" defaultValue={location.instructions} maxLength={1200} /></label>
            <label className={labelClassName}>Display order<input className={inputClassName} name="sort_order" type="number" min="-32768" max="32767" defaultValue={location.sort_order} required /></label>
            <label className={labelClassName}>Availability<select className={inputClassName} name="is_active" defaultValue={String(location.is_active)}><option value="true">Active</option><option value="false">Inactive</option></select></label>
            <div className="sm:col-span-2"><Button type="submit" variant="secondary">Save pickup point</Button></div>
          </form>)}</div> : <div className="rounded-[22px] border border-dashed border-[#d9d2e0] bg-white p-8 text-center text-sm text-[#77717e]">No pickup points yet. Add an approved campus meeting point below.</div>}
          <form action={savePickupLocation} className="grid gap-3 rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:grid-cols-2 sm:p-6">
            <input type="hidden" name="location_id" value="" />
            {isSuperAdmin ? <label className={labelClassName}>College<select className={inputClassName} name="college_id" defaultValue={collegeId} required>{colleges.map((college) => <option value={college.id} key={college.id}>{college.name}</option>)}</select></label> : <input type="hidden" name="college_id" value={collegeId} />}
            <label className={labelClassName}>New pickup point<input className={inputClassName} name="name" minLength={2} maxLength={120} required placeholder="Use an approved campus location" /></label>
            <label className="block text-xs font-semibold text-[#625b6b] sm:col-span-2">Address / meeting point<input className={inputClassName} name="address" minLength={3} maxLength={300} required placeholder="Building, gate or other clear landmark" /></label>
            <label className="block text-xs font-semibold text-[#625b6b] sm:col-span-2">Instructions<textarea className={`${inputClassName} min-h-20 resize-y py-3`} name="instructions" maxLength={1200} placeholder="Optional guidance for buyers and sellers" /></label>
            <label className={labelClassName}>Display order<input className={inputClassName} name="sort_order" type="number" min="-32768" max="32767" defaultValue={0} required /></label>
            <input type="hidden" name="is_active" value="true" />
            <div className="sm:col-span-2"><Button type="submit">Add pickup point</Button></div>
          </form>
        </div>
      </section>
    </main>
  );
}
