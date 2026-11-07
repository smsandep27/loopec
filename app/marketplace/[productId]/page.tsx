import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Bookmark, MessageCircle, PackageOpen, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { ProductCard, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { requireApprovedMember } from "@/lib/auth/member";
import { addToCart, buyNow, reportListing, startConversation, toggleWishlist } from "@/app/marketplace/actions";

export const instant = false;

type Product = {
  id: string;
  seller_id: string;
  college_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number | string;
  item_condition: MarketplaceProduct["item_condition"];
  quantity: number;
  is_featured: boolean;
  published_at: string | null;
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const conditionLabels: Record<Product["item_condition"], string> = { new: "New", like_new: "Like new", good: "Good", used: "Used" };

export default async function ProductDetailsPage({ params, searchParams }: PageProps<"/marketplace/[productId]">) {
  const [{ productId }, search] = await Promise.all([params, searchParams]);
  const { supabase, userId, profile } = await requireApprovedMember();
  const { data: productData } = await supabase
    .from("products")
    .select("id, seller_id, college_id, category_id, name, description, price, item_condition, quantity, is_featured, published_at")
    .eq("id", productId)
    .eq("status", "approved")
    .eq("college_id", profile.college_id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();
  if (!productData) notFound();
  const product = productData as Product;
  const [{ data: sellerData }, { data: categoryData }, { data: imageData }, { data: savedData }, { data: reviewData }, { data: relatedData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, handle, role, verification_status").eq("id", product.seller_id).maybeSingle(),
    supabase.from("categories").select("name, slug").eq("id", product.category_id).maybeSingle(),
    supabase.from("product_images").select("id, storage_path, alt_text, sort_order").eq("product_id", product.id).order("sort_order"),
    supabase.from("wishlists").select("product_id").eq("user_id", userId).eq("product_id", product.id).maybeSingle(),
    supabase.from("reviews").select("rating").eq("reviewed_user_id", product.seller_id).limit(100),
    supabase.from("products").select("id, seller_id, category_id, name, description, price, item_condition, quantity, is_featured, published_at").eq("college_id", product.college_id).eq("category_id", product.category_id).eq("status", "approved").gt("quantity", 0).neq("id", product.id).order("published_at", { ascending: false, nullsFirst: false }).limit(4),
  ]);
  const seller = sellerData as { id: string; full_name: string; handle: string; role: string; verification_status: string } | null;
  const category = categoryData as { name: string; slug: string } | null;
  const images = (imageData ?? []) as { id: string; storage_path: string; alt_text: string; sort_order: number }[];
  const reviewRatings = (reviewData ?? []).map((item) => Number((item as { rating: number }).rating));
  const averageRating = reviewRatings.length ? reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length : null;
  const imageUrls = await Promise.all(images.map(async (image) => {
    const { data } = await supabase.storage.from("product-images").createSignedUrl(image.storage_path, 15 * 60);
    return { ...image, url: data?.signedUrl ?? null };
  }));
  const otherProducts = (relatedData ?? []) as Product[];
  const relatedSellerIds = [...new Set(otherProducts.map((item) => item.seller_id))];
  const [{ data: relatedSellers }, { data: relatedImages }, { data: relatedSaved }] = await Promise.all([
    relatedSellerIds.length ? supabase.from("profiles").select("id, full_name, handle").in("id", relatedSellerIds) : Promise.resolve({ data: [] }),
    otherProducts.length ? supabase.from("product_images").select("product_id, storage_path, sort_order").in("product_id", otherProducts.map((item) => item.id)).order("sort_order") : Promise.resolve({ data: [] }),
    otherProducts.length ? supabase.from("wishlists").select("product_id").eq("user_id", userId).in("product_id", otherProducts.map((item) => item.id)) : Promise.resolve({ data: [] }),
  ]);
  const relatedSellerMap = new Map(((relatedSellers ?? []) as { id: string; full_name: string; handle: string }[]).map((item) => [item.id, item]));
  const relatedImageMap = new Map<string, string>();
  for (const image of (relatedImages ?? []) as { product_id: string; storage_path: string; sort_order: number }[]) if (!relatedImageMap.has(image.product_id)) relatedImageMap.set(image.product_id, image.storage_path);
  const relatedUrls = await Promise.all([...relatedImageMap.entries()].map(async ([id, path]) => {
    const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 15 * 60);
    return [id, data?.signedUrl ?? null] as const;
  }));
  const relatedUrlMap = new Map(relatedUrls);
  const categoryName = category?.name ?? "Campus finds";
  const relatedCards: MarketplaceProduct[] = otherProducts.map((item) => {
    const itemSeller = relatedSellerMap.get(item.seller_id);
    return {
      ...item,
      categoryName,
      sellerName: itemSeller?.full_name ?? "Verified member",
      sellerHandle: itemSeller?.handle ?? "member",
      imageUrl: relatedUrlMap.get(item.id) ?? null,
    };
  });
  const query = await search;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const savedRelated = new Set((relatedSaved ?? []).map((item) => (item as { product_id: string }).product_id));
  const sellerRole = seller?.role === "faculty" ? "Faculty" : seller?.role === "staff" ? "College staff" : "Student";

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85"><div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8"><Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Marketplace</span></Link><Link href="/cart" className="text-xs font-semibold text-violet-800 hover:text-violet-950">View cart</Link></div></header>
      <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">
        <Link className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900" href="/marketplace"><ArrowLeft size={14} /> Back to marketplace</Link>
        {error ? <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{error === "stock" ? "There is not enough stock for another item." : "This listing is not available for that action."}</p> : null}
        {search.reported ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Thank you. Your report was sent to a college administrator for review.</p> : null}
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(350px,.9fr)] lg:gap-12">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {imageUrls.length ? imageUrls.map((image, index) => (
              <div className={`relative aspect-square overflow-hidden rounded-[24px] bg-[#eeeaf2] ${index === 0 && imageUrls.length > 1 ? "col-span-2 aspect-[1.45/1]" : ""}`} key={image.id}>
                {image.url ? <Image src={image.url} alt={image.alt_text || product.name} fill sizes="(max-width: 1024px) 90vw, 55vw" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-violet-300"><PackageOpen size={34} /></span>}
              </div>
            )) : <div className="col-span-2 grid aspect-[1.15/1] place-items-center rounded-[24px] bg-[#eeeaf2] text-violet-300"><PackageOpen size={40} strokeWidth={1.2} /></div>}
          </div>
          <div className="lg:pt-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-violet-700"><span>{categoryName}</span>{product.is_featured ? <><span className="text-[#c9c1d2]">·</span><span className="inline-flex items-center gap-1"><Sparkles size={12} /> Featured</span></> : null}</div>
            <h1 className="mt-3 font-serif text-4xl tracking-[-.05em] text-[#28232f] sm:text-5xl">{product.name}</h1>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-[#302b37]">{currency.format(Number(product.price))}</p>
            <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#5d5764]">{conditionLabels[product.item_condition]}</span><span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#5d5764]">{product.quantity} available</span></div>
            <div className="mt-7 border-t border-[#e8e5e2] pt-6">
              <h2 className="text-xs font-bold uppercase tracking-[.12em] text-[#595361]">About this item</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#716b77]">{product.description}</p>
            </div>
            <div className="mt-7 rounded-[22px] border border-[#e8e5e2] bg-white p-4 sm:p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#908995]">Seller</p>
              <div className="mt-3 flex items-center justify-between gap-4">
                <Link href={`/members/${seller?.handle ?? "member"}`} className="group flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-violet-50 font-serif text-lg text-violet-800">{(seller?.full_name ?? "M").slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0"><b className="flex items-center gap-1.5 truncate text-sm text-[#383240] group-hover:text-violet-800">{seller?.full_name ?? "Verified member"}{seller?.verification_status === "approved" ? <BadgeCheck size={15} className="shrink-0 text-violet-700" /> : null}</b><small className="mt-1 block text-xs text-[#88818d]">{sellerRole} · @{seller?.handle ?? "member"}</small></span>
                </Link>
                <div className="shrink-0 text-right"><p className="text-sm font-semibold text-[#393341]">{averageRating ? `${averageRating.toFixed(1)} / 5` : "New seller"}</p><small className="text-[10px] text-[#928b96]">{reviewRatings.length ? `${reviewRatings.length} reviews` : "No reviews yet"}</small></div>
              </div>
            </div>
            {product.seller_id !== userId ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <form action={addToCart}><input type="hidden" name="product_id" value={product.id} /><button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#ddd7e4] bg-white px-5 text-sm font-semibold text-[#403a47] transition hover:border-violet-300 hover:text-violet-900" type="submit"><ShoppingBag size={16} /> Add to cart</button></form>
                <form action={buyNow}><input type="hidden" name="product_id" value={product.id} /><button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-violet-950 px-5 text-sm font-semibold text-white transition hover:bg-violet-900" type="submit">Buy now <ShoppingBag size={16} /></button></form>
                <div className="flex gap-2 sm:col-span-2">
                  <form action={startConversation}><input type="hidden" name="product_id" value={product.id} /><button className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[#ddd7e4] bg-white px-4 text-sm font-semibold text-[#403a47] transition hover:border-violet-300 hover:text-violet-900" type="submit"><MessageCircle size={16} /> Message seller</button></form>
                  <form action={toggleWishlist}><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="return_to" value={`/marketplace/${product.id}`} /><button className="grid size-12 shrink-0 place-items-center rounded-full border border-[#ddd7e4] bg-white text-violet-800 transition hover:border-violet-300" type="submit" title={savedData ? "Remove from wishlist" : "Save to wishlist"} aria-label={savedData ? "Remove from wishlist" : "Save to wishlist"}><Bookmark size={17} fill={savedData ? "currentColor" : "none"} /></button></form>
                </div>
              </div>
            ) : <p className="mt-5 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900">This is your listing. Manage it from <Link className="font-semibold underline" href="/listings">My listings</Link>.</p>}
            {product.seller_id !== userId ? <details className="mt-5 rounded-2xl border border-[#e8e5e2] bg-white px-4 py-3"><summary className="cursor-pointer text-xs font-semibold text-[#756e7b]">Report this listing</summary><form action={reportListing} className="mt-4 space-y-3"><input type="hidden" name="product_id" value={product.id} /><label className="block text-xs font-semibold text-[#625b6b]">Reason<select className="mt-2 min-h-11 w-full rounded-xl border border-[#e4e0e8] bg-white px-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="reason" required defaultValue=""><option value="" disabled>Select a reason</option><option value="prohibited_item">Prohibited item</option><option value="misleading_listing">Misleading listing</option><option value="safety">Safety concern</option><option value="harassment">Harassment</option><option value="other">Other</option></select></label><label className="block text-xs font-semibold text-[#625b6b]">Details <span className="font-normal">(optional)</span><textarea className="mt-2 min-h-20 w-full resize-y rounded-xl border border-[#e4e0e8] p-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="details" maxLength={2000} /></label><button className="min-h-10 rounded-full border border-rose-200 px-4 text-xs font-semibold text-rose-800 hover:bg-rose-50" type="submit">Send report to admin</button></form></details> : null}
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#88818d]"><ShieldCheck className="mt-0.5 shrink-0 text-violet-700" size={15} /> Arrange pickup at an approved campus location and coordinate through LOOPEC messages.</p>
          </div>
        </div>
        {relatedCards.length ? <section className="mt-16 border-t border-[#e8e5e2] pt-9"><div className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">From the same category</p><h2 className="mt-2 font-serif text-3xl tracking-[-.04em] text-[#28232f]">More around your campus</h2></div><Link className="text-xs font-semibold text-violet-800 hover:text-violet-950" href={`/marketplace?category=${product.category_id}`}>See all</Link></div><div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{relatedCards.map((item) => <ProductCard key={item.id} product={item} saved={savedRelated.has(item.id)} currentUserId={userId} returnTo={`/marketplace/${product.id}`} />)}</div></section> : null}
      </section>
    </main>
  );
}
