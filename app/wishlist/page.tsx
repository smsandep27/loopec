import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { ProductCard, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { requireApprovedMember } from "@/lib/auth/member";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type Product = {
  id: string; seller_id: string; category_id: string; name: string; description: string; price: number | string;
  item_condition: MarketplaceProduct["item_condition"]; quantity: number; is_featured: boolean; published_at: string | null;
};

export default async function WishlistPage() {
  const { supabase, userId } = await requireApprovedMember();
  const { data: savedData } = await supabase.from("wishlists").select("product_id").eq("user_id", userId).order("created_at", { ascending: false });
  const savedIds = (savedData ?? []).map((item) => (item as { product_id: string }).product_id);
  const { data: productData } = savedIds.length
    ? await supabase.from("products").select("id, seller_id, category_id, name, description, price, item_condition, quantity, is_featured, published_at").in("id", savedIds).eq("status", "approved").gt("quantity", 0)
    : { data: [] };
  const products = (productData ?? []) as Product[];
  const sellerIds = [...new Set(products.map((product) => product.seller_id))];
  const categoryIds = [...new Set(products.map((product) => product.category_id))];
  const productIds = products.map((product) => product.id);
  const [{ data: sellerData }, { data: categoryData }, { data: imageData }] = await Promise.all([
    sellerIds.length ? supabase.from("profiles").select("id, full_name, handle").in("id", sellerIds) : Promise.resolve({ data: [] }),
    categoryIds.length ? supabase.from("categories").select("id, name").in("id", categoryIds) : Promise.resolve({ data: [] }),
    productIds.length ? supabase.from("product_images").select("product_id, storage_path, sort_order").in("product_id", productIds).order("sort_order") : Promise.resolve({ data: [] }),
  ]);
  const sellers = new Map(((sellerData ?? []) as { id: string; full_name: string; handle: string }[]).map((item) => [item.id, item]));
  const categories = new Map(((categoryData ?? []) as { id: string; name: string }[]).map((item) => [item.id, item.name]));
  const paths = new Map<string, string>();
  for (const image of (imageData ?? []) as { product_id: string; storage_path: string; sort_order: number }[]) if (!paths.has(image.product_id)) paths.set(image.product_id, image.storage_path);
  const signed = await Promise.all([...paths.entries()].map(async ([id, path]) => {
    const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 15 * 60);
    return [id, data?.signedUrl ?? null] as const;
  }));
  const images = new Map(signed);
  const cards: MarketplaceProduct[] = products.map((product) => {
    const seller = sellers.get(product.seller_id);
    return { ...product, categoryName: categories.get(product.category_id) ?? "Campus finds", sellerName: seller?.full_name ?? "Verified member", sellerHandle: seller?.handle ?? "member", imageUrl: images.get(product.id) ?? null };
  });

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85"><div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8"><Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Wishlist</span></Link><nav className="flex items-center gap-4"><Link href="/cart" className="text-xs font-semibold text-violet-800">Cart</Link><form action={signOut}><button className="text-xs font-semibold text-[#77717e]" type="submit">Sign out</button></form></nav></div></header>
      <section className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Marketplace</Link>
        <div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Saved for later</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Your wishlist</h1></div>
        {cards.length ? <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cards.map((product) => <ProductCard key={product.id} product={product} saved returnTo="/wishlist" currentUserId={userId} />)}</div> : (
          <div className="mt-7 rounded-[26px] border border-dashed border-[#d9d2e0] bg-white px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6f3fa] text-violet-800"><Bookmark size={22} /></span><h2 className="mt-4 font-serif text-2xl text-[#28232f]">Keep an eye on something.</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#77717e]">Save listings as you browse, and they’ll be gathered here for your next campus find.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" href="/marketplace">Browse listings</Link></div>
        )}
      </section>
    </main>
  );
}
