import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { AuthShell, FormNotice } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authMessage } from "@/lib/auth/messages";
import { getCurrentMember } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { addCategory, toggleCategory, updateCommission } from "@/app/admin/actions";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type Category = { id: string; name: string; slug: string; sort_order: number; is_active: boolean };

export default async function AdminSettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Platform settings" title="Pilot setup is incomplete" description="Platform configuration will be available when the pilot database is connected."><Link href="/setup" className="font-semibold text-violet-800">View setup details</Link></AuthShell>;
  const admin = await getCurrentMember();
  if (!admin.userId || !admin.profile || admin.profile.role !== "super_admin" || admin.profile.suspended_at) {
    return <AuthShell eyebrow="Restricted area" title="Super admin access only" description="Global categories and commission settings are limited to the super administrator."><Link href="/admin" className="font-semibold text-violet-800">Return to admin</Link></AuthShell>;
  }
  const [{ data: settingData }, { data: categoryData }] = await Promise.all([
    admin.supabase.from("platform_settings").select("value").eq("key", "default_commission_percent").maybeSingle(),
    admin.supabase.from("categories").select("id, name, slug, sort_order, is_active").order("sort_order"),
  ]);
  const settingValue = settingData?.value as number | undefined;
  const categories = (categoryData ?? []) as Category[];

  return (
    <main className="min-h-screen bg-[#f7f6f4] px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/admin" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Admin</span></Link><form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form></header>
      <section className="mx-auto mt-11 max-w-5xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Admin home</Link>
        <div className="mt-5 border-b border-[#e8e5e2] pb-7"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-violet-700"><SlidersHorizontal size={14} /> Super admin</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Platform settings</h1><p className="mt-2 text-sm leading-6 text-[#77717e]">Changes are restricted to the super admin and recorded in the audit log.</p></div>
        <div className="mt-6 space-y-4">{errorCode ? <FormNotice>{authMessage(errorCode)}</FormNotice> : null}{params.saved || params.category_added || params.category_saved ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Platform setting saved.</p> : null}
          <section className="rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-[#302b37]">Marketplace commission</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[#77717e]">Applied to seller proceeds when an order payment is verified. Default for this pilot: 5%.</p><form action={updateCommission} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="block text-xs font-semibold text-[#625b6b]">Commission percent<input className="mt-2 min-h-12 w-full rounded-xl border border-[#e4e0e8] px-3.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 sm:w-48" name="percent" type="number" min="0" max="100" step="0.01" defaultValue={settingValue ?? 5} required /></label><Button size="md" type="submit">Save commission rate</Button></form></section>
          <section className="rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold text-[#302b37]">Listing categories</h2><p className="mt-1 text-sm text-[#77717e]">Inactive categories stay attached to old items but are hidden from new listings.</p></div><span className="text-xs text-[#908995]">{categories.length} total</span></div>
            <div className="mt-4 divide-y divide-[#f0edf0]">{categories.map((category) => <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0" key={category.id}><span><b className="block text-sm text-[#393341]">{category.name}</b><small className="mt-1 block text-xs text-[#8b8590]">/{category.slug} · order {category.sort_order}</small></span><form action={toggleCategory}><input type="hidden" name="category_id" value={category.id} /><input type="hidden" name="active" value={category.is_active ? "false" : "true"} /><button className={`min-h-9 rounded-full border px-4 text-xs font-semibold ${category.is_active ? "border-amber-200 text-amber-900 hover:bg-amber-50" : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"}`} type="submit">{category.is_active ? "Deactivate" : "Activate"}</button></form></div>)}</div>
            <form action={addCategory} className="mt-5 grid gap-3 border-t border-[#f0edf0] pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"><label className="block text-xs font-semibold text-[#625b6b]">New category name<input className="mt-2 min-h-11 w-full rounded-xl border border-[#e4e0e8] px-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="name" minLength={2} maxLength={80} required placeholder="e.g. Lab equipment" /></label><label className="block text-xs font-semibold text-[#625b6b]">Slug <span className="font-normal">(optional)</span><input className="mt-2 min-h-11 w-full rounded-xl border border-[#e4e0e8] px-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="slug" maxLength={80} placeholder="lab-equipment" /></label><Button variant="secondary" type="submit">Add category</Button></form>
          </section>
        </div>
      </section>
    </main>
  );
}
