import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { AuthShell, FormNotice, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authMessage } from "@/lib/auth/messages";
import { requireApprovedMember } from "@/lib/auth/member";
import { deleteListing, removeListingImage, submitListing, updateListing } from "@/app/listings/actions";

export const instant = false;

type Listing = { id: string; name: string; description: string; price: number | string; category_id: string; item_condition: "new" | "like_new" | "good" | "used"; quantity: number; status: string; moderation_notes: string | null };
type Category = { id: string; name: string };

export default async function EditListingPage({ params, searchParams }: PageProps<"/listings/[productId]/edit">) {
  const [{ productId }, queryParams] = await Promise.all([params, searchParams]);
  const errorCode = Array.isArray(queryParams.error) ? queryParams.error[0] : queryParams.error;
  const { supabase, userId } = await requireApprovedMember();
  const { data: listingData } = await supabase.from("products").select("id, seller_id, name, description, price, category_id, item_condition, quantity, status, moderation_notes").eq("id", productId).maybeSingle();
  if (!listingData || listingData.seller_id !== userId) notFound();
  const listing = listingData as Listing & { seller_id: string };
  if (listing.status !== "draft" && listing.status !== "rejected") {
    return <AuthShell eyebrow="Seller studio" title="This listing is locked" description="Listings under review or already published can’t be edited. You can track their current status from My listings." footer={<Link className="font-semibold text-violet-800" href="/listings">Back to my listings</Link>}><p className="rounded-2xl bg-violet-50 p-4 text-sm text-violet-950">Status: {listing.status === "pending" ? "In review" : listing.status}</p></AuthShell>;
  }
  const [{ data: categoryData }, { data: imageData }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("product_images").select("id, storage_path, alt_text, sort_order").eq("product_id", listing.id).order("sort_order"),
  ]);
  const categories = (categoryData ?? []) as Category[];
  const images = await Promise.all(((imageData ?? []) as { id: string; storage_path: string; alt_text: string; sort_order: number }[]).map(async (image) => {
    const { data } = await supabase.storage.from("product-images").createSignedUrl(image.storage_path, 15 * 60);
    return { ...image, url: data?.signedUrl ?? null };
  }));
  const infoMessage = errorCode ? authMessage(errorCode) : null;

  return (
    <AuthShell eyebrow="Seller studio" title="Edit your listing" description="Update your item details or photos, then send it back to the college admin for review." footer={<Link className="font-semibold text-violet-800 hover:text-violet-950" href="/listings">Back to my listings</Link>}>
      <div className="space-y-5">
        {infoMessage ? <FormNotice>{infoMessage}</FormNotice> : null}
        {queryParams.saved ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Listing details saved.</p> : null}
        {queryParams.removed ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Photo removed.</p> : null}
        {listing.moderation_notes ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950">Admin feedback: {listing.moderation_notes}</p> : null}
        {images.length ? <div><p className={labelClassName}>Listing photos</p><div className="mt-2 grid grid-cols-2 gap-3">{images.map((image) => <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#f0edf3]" key={image.id}>{image.url ? <Image src={image.url} alt={image.alt_text || listing.name} fill sizes="220px" unoptimized className="object-cover" /> : null}<form action={removeListingImage} className="absolute right-2 top-2"><input type="hidden" name="image_id" value={image.id} /><button className="grid size-9 place-items-center rounded-full bg-white/95 text-rose-700 shadow-sm hover:bg-rose-50" type="submit" aria-label="Remove photo"><Trash2 size={15} /></button></form></div>)}</div><p className="mt-2 text-xs text-[#87818c]">{images.length} of 20 photos</p></div> : <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">Add at least one photo before resubmitting.</p>}
        <form action={updateListing} className="space-y-4">
          <input type="hidden" name="product_id" value={listing.id} />
          <label className={labelClassName}>Item name<input className={inputClassName} name="name" minLength={3} maxLength={140} required defaultValue={listing.name} /></label>
          <label className={labelClassName}>Description<textarea className={`${inputClassName} min-h-32 resize-y py-3`} name="description" minLength={10} maxLength={5000} required defaultValue={listing.description} /></label>
          <div className="grid grid-cols-2 gap-3"><label className={labelClassName}>Price (INR)<input className={inputClassName} name="price" type="number" min="0" max="9999999999.99" step="0.01" required defaultValue={listing.price} /></label><label className={labelClassName}>Quantity<input className={inputClassName} name="quantity" type="number" min="1" max="1000" step="1" required defaultValue={listing.quantity} /></label></div>
          <label className={labelClassName}>Category<select className={inputClassName} name="category_id" required defaultValue={listing.category_id}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className={labelClassName}>Condition<select className={inputClassName} name="item_condition" required defaultValue={listing.item_condition}><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="used">Used</option></select></label>
          {images.length < 20 ? <label className={labelClassName}>Add photos<input className={`${inputClassName} file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-950`} name="images" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple /><span className="mt-1.5 block text-xs font-normal text-[#87818c]">Up to 5 new photos, 4 MB each. This listing can have up to 20 photos total.</span></label> : null}
          <Button className="w-full" size="lg" variant="secondary" type="submit"><ImagePlus size={16} /> Save listing details</Button>
        </form>
        <form action={submitListing}><input type="hidden" name="product_id" value={listing.id} /><Button className="w-full" size="lg" type="submit">Submit listing for review</Button></form>
        <form action={deleteListing}><input type="hidden" name="product_id" value={listing.id} /><button className="min-h-11 w-full rounded-full text-sm font-semibold text-rose-700 hover:bg-rose-50" type="submit">Delete draft</button></form>
        <Link className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-950" href="/listings"><ArrowLeft size={14} /> My listings</Link>
      </div>
    </AuthShell>
  );
}
