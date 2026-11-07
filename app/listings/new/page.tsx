import Link from "next/link";
import { ArrowLeft, ImagePlus, ShieldCheck } from "lucide-react";
import { AuthShell, FormNotice, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { requireApprovedMember } from "@/lib/auth/member";
import { createListing } from "@/app/listings/actions";
import { authMessage } from "@/lib/auth/messages";

export const instant = false;

type Category = { id: string; name: string };

export default async function NewListingPage({ searchParams }: PageProps<"/listings/new">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const { supabase, profile } = await requireApprovedMember();
  const { data } = await supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order");
  const categories = (data ?? []) as Category[];
  const errorMessage = errorCode ? authMessage(errorCode) : null;

  return (
    <AuthShell eyebrow="Seller studio" title="Create a listing" description="Share a useful item with your college community. New listings are reviewed by a college admin before they appear in search." footer={<Link className="font-semibold text-violet-800 hover:text-violet-950" href="/listings">My listings</Link>}>
      <div className="space-y-5">
        {errorMessage ? <FormNotice>{errorMessage}</FormNotice> : null}
        {!profile.college_id ? <FormNotice>Your approved profile needs a college assignment before you can list an item.</FormNotice> : categories.length === 0 ? <FormNotice>No active categories are configured yet. Contact your college admin.</FormNotice> : (
          <form action={createListing} className="space-y-4">
            <label className={labelClassName}>Item name<input className={inputClassName} name="name" minLength={3} maxLength={140} required placeholder="e.g. Introductory chemistry textbook" /></label>
            <label className={labelClassName}>Description<textarea className={`${inputClassName} min-h-32 resize-y py-3`} name="description" minLength={10} maxLength={5000} required placeholder="Describe the item clearly, including anything a buyer should know." /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClassName}>Price (INR)<input className={inputClassName} name="price" type="number" min="0" max="9999999999.99" step="0.01" required /></label>
              <label className={labelClassName}>Quantity<input className={inputClassName} name="quantity" type="number" min="1" max="1000" step="1" required defaultValue="1" /></label>
            </div>
            <label className={labelClassName}>Category<select className={inputClassName} name="category_id" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className={labelClassName}>Condition<select className={inputClassName} name="item_condition" required defaultValue="good"><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="used">Used</option></select></label>
            <label className={labelClassName}>Photos<input className={`${inputClassName} file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-950`} name="images" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple required /><span className="mt-1.5 block text-xs font-normal leading-5 text-[#87818c]">Add 1–5 photos (JPG, PNG or WebP; up to 4 MB each). We check the file signature and store images privately.</span></label>
            <div className="flex gap-3 rounded-2xl bg-[#f6f3fa] p-4 text-xs leading-5 text-[#625b6b]"><ImagePlus className="mt-0.5 shrink-0 text-violet-800" size={16} /><p>Listings are visible to approved members of your college only after review.</p></div>
            <Button className="w-full" size="lg" type="submit"><ShieldCheck size={16} /> Submit listing for review</Button>
          </form>
        )}
        <Link className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-950" href="/marketplace"><ArrowLeft size={14} /> Return to marketplace</Link>
      </div>
    </AuthShell>
  );
}
