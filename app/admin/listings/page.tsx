import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, FileText, PackageCheck, ShieldCheck } from "lucide-react";
import { AuthShell, FormNotice } from "@/components/auth/auth-shell";
import { authMessage } from "@/lib/auth/messages";
import { getCurrentMember } from "@/lib/auth/member";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { moderateProduct } from "@/app/admin/actions";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type Listing = { id: string; seller_id: string; category_id: string; name: string; description: string; price: number | string; item_condition: string; quantity: number; moderation_notes: string | null; created_at: string };

export default async function AdminListingsPage({ searchParams }: PageProps<"/admin/listings">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Listing moderation" title="Pilot setup is incomplete" description="Connect the pilot database to review campus listings."><Link href="/setup" className="font-semibold text-violet-800">View setup details</Link></AuthShell>;
  const member = await getCurrentMember();
  if (!member.userId || !member.profile || !["college_admin", "super_admin"].includes(member.profile.role) || member.profile.suspended_at) {
    return <AuthShell eyebrow="Restricted area" title="College administrators only" description="Your account does not have access to listing moderation."><Link href="/" className="font-semibold text-violet-800">Return to home</Link></AuthShell>;
  }
  let query = member.supabase.from("products").select("id, seller_id, category_id, name, description, price, item_condition, quantity, moderation_notes, created_at").eq("status", "pending").order("created_at", { ascending: true });
  if (member.profile.role !== "super_admin" && member.profile.college_id) query = query.eq("college_id", member.profile.college_id);
  const { data: listingData, error: queryError } = await query;
  const listings = (listingData ?? []) as Listing[];
  const sellerIds = [...new Set(listings.map((listing) => listing.seller_id))];
  const categoryIds = [...new Set(listings.map((listing) => listing.category_id))];
  const listingIds = listings.map((listing) => listing.id);
  const [{ data: sellerData }, { data: categoryData }, { data: imageData }] = await Promise.all([
    sellerIds.length ? member.supabase.from("profiles").select("id, full_name, handle").in("id", sellerIds) : Promise.resolve({ data: [] }),
    categoryIds.length ? member.supabase.from("categories").select("id, name").in("id", categoryIds) : Promise.resolve({ data: [] }),
    listingIds.length ? member.supabase.from("product_images").select("product_id, storage_path, sort_order").in("product_id", listingIds).order("sort_order") : Promise.resolve({ data: [] }),
  ]);
  const sellers = new Map(((sellerData ?? []) as { id: string; full_name: string; handle: string }[]).map((item) => [item.id, item]));
  const categories = new Map(((categoryData ?? []) as { id: string; name: string }[]).map((item) => [item.id, item.name]));
  const paths = new Map<string, string>();
  for (const image of (imageData ?? []) as { product_id: string; storage_path: string; sort_order: number }[]) if (!paths.has(image.product_id)) paths.set(image.product_id, image.storage_path);
  const signed = await Promise.all([...paths.entries()].map(async ([id, path]) => {
    const { data } = await member.supabase.storage.from("product-images").createSignedUrl(path, 90);
    return [id, data?.signedUrl ?? null] as const;
  }));
  const images = new Map(signed);
  const rejected = Boolean(params.reviewed);
  const error = errorCode === "moderation" ? authMessage("moderation") : authMessage(errorCode);

  return (
    <main className="min-h-screen bg-[#f7f6f4] px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/admin" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Admin</span></Link><div className="flex items-center gap-4"><Link className="text-xs font-semibold text-violet-800" href="/admin">Verification queue</Link><form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form></div></header>
      <section className="mx-auto mt-11 max-w-6xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Admin home</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[#e8e5e2] pb-7"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-violet-700"><ShieldCheck size={14} /> Marketplace integrity</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Listing moderation</h1><p className="mt-2 text-sm text-[#77717e]">Review new listings before they appear in campus search.</p></div><span className="rounded-full border border-[#e8e3ec] bg-white px-4 py-2 text-xs font-semibold text-[#5e5765]">{listings.length} pending</span></div>
        <div className="mt-6 space-y-4">{error ? <FormNotice>{error}</FormNotice> : null}{rejected ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Listing decision saved.</p> : null}{queryError ? <FormNotice>We could not load the listing queue. Check the schema and admin scope.</FormNotice> : null}
          {!queryError && !listings.length ? <div className="rounded-[26px] border border-dashed border-[#d9d2e0] bg-white px-6 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-800"><PackageCheck size={22} /></span><h2 className="mt-4 font-serif text-2xl text-[#28232f]">No listings to review</h2><p className="mt-2 text-sm text-[#77717e]">New seller submissions will appear here.</p></div> : null}
          {listings.map((listing) => {
            const seller = sellers.get(listing.seller_id);
            const image = images.get(listing.id);
            return <article className="grid gap-5 rounded-[24px] border border-[#e8e5e2] bg-white p-5 sm:grid-cols-[200px_minmax(0,1fr)_250px] sm:p-6" key={listing.id}>
              <div className="relative aspect-[1.25/1] overflow-hidden rounded-2xl bg-[#f1edf4] sm:aspect-square">{image ? <Image src={image} alt={listing.name} fill sizes="200px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-violet-300"><FileText size={24} /></span>}</div>
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-violet-700">{categories.get(listing.category_id) ?? "Marketplace listing"}</p><h2 className="mt-2 text-lg font-semibold text-[#302b37]">{listing.name}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#716b77]">{listing.description}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-[#736c79]"><span className="rounded-full bg-[#f7f5f8] px-3 py-1.5">₹{Number(listing.price).toLocaleString("en-IN")}</span><span className="rounded-full bg-[#f7f5f8] px-3 py-1.5">{listing.item_condition.replace("_", " ")}</span><span className="rounded-full bg-[#f7f5f8] px-3 py-1.5">{listing.quantity} available</span></div><p className="mt-4 text-xs text-[#8b8590]">Seller: {seller?.full_name ?? "Verified member"} {seller ? `· @${seller.handle}` : ""}</p></div>
              <div className="flex flex-col gap-2 sm:justify-center"><form action={moderateProduct}><input type="hidden" name="product_id" value={listing.id} /><input type="hidden" name="decision" value="approved" /><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-violet-950 px-4 text-sm font-semibold text-white hover:bg-violet-900" type="submit"><Check size={15} /> Approve listing</button></form><form action={moderateProduct} className="space-y-2"><input type="hidden" name="product_id" value={listing.id} /><input type="hidden" name="decision" value="rejected" /><label className="block text-xs font-semibold text-[#625b6b]">Reason for rejection<textarea className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-[#e4e0e8] p-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="moderator_notes" minLength={5} maxLength={1000} required defaultValue={listing.moderation_notes ?? ""} /></label><button className="min-h-10 w-full rounded-full border border-rose-200 px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50" type="submit">Reject with reason</button></form></div>
            </article>;
          })}
        </div>
      </section>
    </main>
  );
}
