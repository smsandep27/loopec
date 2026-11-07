import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CirclePlus, PackageOpen, Pencil, Trash2 } from "lucide-react";
import { requireApprovedMember } from "@/lib/auth/member";
import { deleteListing, withdrawListing } from "@/app/listings/actions";
import { signOut } from "@/app/auth/actions";
import { authMessage } from "@/lib/auth/messages";

export const instant = false;

type Listing = { id: string; category_id: string; name: string; description: string; price: number | string; status: string; quantity: number; moderation_notes: string | null; created_at: string };
const statusLabels: Record<string, string> = { draft: "Draft", pending: "In review", approved: "Live", sold: "Sold", rejected: "Needs an update", removed: "Unavailable" };

export default async function MyListingsPage({ searchParams }: PageProps<"/listings">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const { supabase, userId } = await requireApprovedMember();
  const { data: listingData } = await supabase.from("products").select("id, category_id, name, description, price, status, quantity, moderation_notes, created_at").eq("seller_id", userId).order("created_at", { ascending: false });
  const listings = (listingData ?? []) as Listing[];
  const ids = listings.map((listing) => listing.id);
  const categoryIds = [...new Set(listings.map((listing) => listing.category_id))];
  const [{ data: imageData }, { data: categoryData }] = await Promise.all([
    ids.length ? supabase.from("product_images").select("product_id, storage_path, sort_order").in("product_id", ids).order("sort_order") : Promise.resolve({ data: [] }),
    categoryIds.length ? supabase.from("categories").select("id, name").in("id", categoryIds) : Promise.resolve({ data: [] }),
  ]);
  const paths = new Map<string, string>();
  for (const image of (imageData ?? []) as { product_id: string; storage_path: string; sort_order: number }[]) if (!paths.has(image.product_id)) paths.set(image.product_id, image.storage_path);
  const signed = await Promise.all([...paths.entries()].map(async ([id, path]) => {
    const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 15 * 60);
    return [id, data?.signedUrl ?? null] as const;
  }));
  const images = new Map(signed);
  const categories = new Map(((categoryData ?? []) as { id: string; name: string }[]).map((item) => [item.id, item.name]));

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85"><div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8"><Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Seller studio</span></Link><div className="flex items-center gap-4"><Link className="text-xs font-semibold text-violet-800" href="/profile">Profile</Link><form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form></div></div></header>
      <section className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Marketplace</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Your seller studio</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">My listings</h1><p className="mt-2 text-sm text-[#77717e]">Track review status and manage your campus items.</p></div><Link className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet-950 px-5 text-sm font-semibold text-white hover:bg-violet-900" href="/listings/new"><CirclePlus size={16} /> New listing</Link></div>
        <div className="mt-6 space-y-4">{errorCode ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{authMessage(errorCode)}</p> : null}{params.submitted ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your listing is in the moderation queue.</p> : null}{params.deleted ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Draft listing deleted.</p> : null}{params.withdrawn ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">The live listing was removed from the marketplace. Its order history is kept.</p> : null}
          {listings.length ? <div className="space-y-3">{listings.map((listing) => {
            const canEdit = listing.status === "draft" || listing.status === "rejected";
            const image = images.get(listing.id);
            return <article className="flex gap-4 rounded-[22px] border border-[#e8e5e2] bg-white p-4 sm:items-center sm:gap-5 sm:p-5" key={listing.id}>
              <Link href={listing.status === "approved" ? `/marketplace/${listing.id}` : canEdit ? `/listings/${listing.id}/edit` : "/listings"} className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-[#f0edf3] sm:size-28">{image ? <Image src={image} alt={listing.name} fill sizes="112px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-violet-300"><PackageOpen size={23} /></span>}</Link>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${listing.status === "approved" ? "bg-emerald-50 text-emerald-800" : listing.status === "rejected" ? "bg-amber-50 text-amber-900" : "bg-violet-50 text-violet-800"}`}>{statusLabels[listing.status] ?? listing.status}</span><span className="text-[10px] text-[#918b96]">{categories.get(listing.category_id) ?? "Campus find"}</span></div><h2 className="mt-2 truncate text-sm font-semibold text-[#393341]">{listing.name}</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#817a87]">{listing.description}</p><p className="mt-2 text-sm font-semibold text-[#302b37]">₹{Number(listing.price).toLocaleString("en-IN")} <span className="font-normal text-[#8b8590]">· {listing.quantity} available</span></p>{listing.moderation_notes ? <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">Admin feedback: {listing.moderation_notes}</p> : null}</div>
              <div className="flex shrink-0 flex-col gap-2 sm:items-end">{canEdit ? <Link className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#e4e0e8] px-3 text-xs font-semibold text-[#5d5664] hover:border-violet-300 hover:text-violet-900" href={`/listings/${listing.id}/edit`}><Pencil size={13} /> Edit draft</Link> : <Link className="inline-flex min-h-9 items-center rounded-full border border-[#e4e0e8] px-3 text-xs font-semibold text-[#5d5664] hover:text-violet-900" href={listing.status === "approved" ? `/marketplace/${listing.id}` : "/listings"}>View status</Link>}{canEdit ? <form action={deleteListing}><input type="hidden" name="product_id" value={listing.id} /><button className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50" type="submit"><Trash2 size={13} /> Delete draft</button></form> : listing.status === "approved" ? <form action={withdrawListing}><input type="hidden" name="product_id" value={listing.id} /><button className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50" type="submit"><Trash2 size={13} /> Remove listing</button></form> : null}</div>
            </article>;
          })}</div> : <div className="rounded-[26px] border border-dashed border-[#d9d2e0] bg-white px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6f3fa] text-violet-800"><PackageOpen size={22} /></span><h2 className="mt-4 font-serif text-2xl text-[#28232f]">Your seller studio is ready.</h2><p className="mt-2 text-sm text-[#77717e]">Share your first useful campus find with the community.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" href="/listings/new">Create a listing</Link></div>}
        </div>
      </section>
    </main>
  );
}
