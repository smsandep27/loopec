import Image from "next/image";
import Link from "next/link";
import { Bookmark, PackageOpen } from "lucide-react";
import { toggleWishlist } from "@/app/marketplace/actions";

export type MarketplaceProduct = {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  price: number | string;
  item_condition: "new" | "like_new" | "good" | "used";
  quantity: number;
  is_featured: boolean;
  published_at: string | null;
  categoryName: string;
  sellerName: string;
  sellerHandle: string;
  imageUrl: string | null;
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const conditionLabel: Record<MarketplaceProduct["item_condition"], string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  used: "Used",
};

export function ProductCard({
  product,
  saved,
  returnTo = "/marketplace",
  showSeller = true,
  currentUserId,
}: {
  product: MarketplaceProduct;
  saved: boolean;
  returnTo?: string;
  showSeller?: boolean;
  currentUserId: string;
}) {
  return (
    <article className="group overflow-hidden rounded-[22px] border border-[#e8e5e2] bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-35px_rgba(43,29,68,.5)]">
      <div className="relative aspect-[1.15/1] overflow-hidden bg-[#f0edf3]">
        {product.imageUrl ? (
          <Image className="object-cover transition duration-500 group-hover:scale-[1.035]" src={product.imageUrl} alt={product.name} fill sizes="(max-width: 640px) 90vw, (max-width: 1024px) 44vw, 25vw" unoptimized />
        ) : (
          <div className="grid h-full place-items-center text-violet-300"><PackageOpen size={34} strokeWidth={1.3} /></div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-semibold text-[#504b57] shadow-sm">{conditionLabel[product.item_condition]}</span>
        {product.is_featured ? <span className="absolute right-3 top-3 rounded-full bg-violet-950 px-3 py-1.5 text-[10px] font-semibold text-white">Featured</span> : null}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[.11em] text-violet-700">{product.categoryName}</p>
            <Link href={`/marketplace/${product.id}`} className="mt-1.5 line-clamp-2 block min-h-[44px] text-[15px] font-semibold leading-[1.45] text-[#302b37] transition hover:text-violet-800">{product.name}</Link>
          </div>
          {product.seller_id !== currentUserId ? (
            <form action={toggleWishlist}>
              <input type="hidden" name="product_id" value={product.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <button className={`grid size-9 shrink-0 place-items-center rounded-full border transition ${saved ? "border-violet-200 bg-violet-50 text-violet-800" : "border-[#ebe7ed] text-[#89828e] hover:border-violet-200 hover:text-violet-800"}`} type="submit" aria-label={saved ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} title={saved ? "Saved to wishlist" : "Save to wishlist"}>
                <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
              </button>
            </form>
          ) : null}
        </div>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#f0edf0] pt-3.5">
          <div>
            <p className="text-lg font-bold tracking-tight text-[#2b2632]">{currency.format(Number(product.price))}</p>
            {showSeller ? <Link href={`/members/${product.sellerHandle}`} className="mt-1 block max-w-[160px] truncate text-[11px] text-[#817a87] hover:text-violet-800">{product.sellerName}</Link> : null}
          </div>
          <span className="text-[10px] text-[#928b96]">{product.quantity} available</span>
        </div>
      </div>
    </article>
  );
}
