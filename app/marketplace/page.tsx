import Link from "next/link";
import { ArrowRight, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { ProductCard, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { requireApprovedMember } from "@/lib/auth/member";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type Category = { id: string; name: string; slug: string };
type ProductRow = {
  id: string;
  seller_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number | string;
  item_condition: MarketplaceProduct["item_condition"];
  quantity: number;
  is_featured: boolean;
  published_at: string | null;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePrice(value?: string) {
  if (!value || value.length > 20) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export default async function MarketplacePage({ searchParams }: PageProps<"/marketplace">) {
  const params = await searchParams;
  const search = (first(params.q) ?? "").trim().slice(0, 100);
  const categoryId = first(params.category) ?? "";
  const minPrice = parsePrice(first(params.min));
  const maxPrice = parsePrice(first(params.max));
  const requestedSort = first(params.sort);
  const sort = requestedSort === "price_low" || requestedSort === "price_high" ? requestedSort : "recent";
  const { supabase, userId, profile } = await requireApprovedMember();

  const [{ data: categoriesData }, { data: pickupData }, { count: unreadCount }] = await Promise.all([
    supabase.from("categories").select("id, name, slug").eq("is_active", true).order("sort_order"),
    profile.college_id
      ? supabase.from("pickup_locations").select("id, name").eq("college_id", profile.college_id).eq("is_active", true).order("sort_order").limit(1)
      : Promise.resolve({ data: [] }),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);
  const categories = (categoriesData ?? []) as Category[];

  let query = supabase
    .from("products")
    .select("id, seller_id, category_id, name, description, price, item_condition, quantity, is_featured, published_at")
    .eq("status", "approved")
    .eq("college_id", profile.college_id ?? "00000000-0000-0000-0000-000000000000")
    .gt("quantity", 0)
    .limit(60);
  if (search) query = query.textSearch("search_vector", search, { type: "plain", config: "simple" });
  if (categoryId && categories.some((category) => category.id === categoryId)) query = query.eq("category_id", categoryId);
  if (minPrice !== null) query = query.gte("price", minPrice);
  if (maxPrice !== null) query = query.lte("price", maxPrice);
  query = query.order("is_featured", { ascending: false });
  if (sort === "price_low") query = query.order("price", { ascending: true });
  else if (sort === "price_high") query = query.order("price", { ascending: false });
  else query = query.order("published_at", { ascending: false, nullsFirst: false });

  const { data: productData, error: productsError } = await query;
  const products = (productData ?? []) as ProductRow[];
  const productIds = products.map((product) => product.id);
  const sellerIds = [...new Set(products.map((product) => product.seller_id))];
  const [{ data: imageData }, { data: sellersData }, { data: savedData }] = await Promise.all([
    productIds.length ? supabase.from("product_images").select("product_id, storage_path, sort_order").in("product_id", productIds).order("sort_order") : Promise.resolve({ data: [] }),
    sellerIds.length ? supabase.from("profiles").select("id, full_name, handle").in("id", sellerIds) : Promise.resolve({ data: [] }),
    productIds.length ? supabase.from("wishlists").select("product_id").eq("user_id", userId).in("product_id", productIds) : Promise.resolve({ data: [] }),
  ]);
  const images = (imageData ?? []) as { product_id: string; storage_path: string; sort_order: number }[];
  const sellers = (sellersData ?? []) as { id: string; full_name: string; handle: string }[];
  const saved = new Set((savedData ?? []).map((row) => (row as { product_id: string }).product_id));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
  const firstImageByProduct = new Map<string, string>();
  for (const image of images) if (!firstImageByProduct.has(image.product_id)) firstImageByProduct.set(image.product_id, image.storage_path);
  const pathByProduct = products.map((product) => firstImageByProduct.get(product.id)).filter((path): path is string => Boolean(path));
  const imageUrls = new Map<string, string>();
  const urlResults = await Promise.all(pathByProduct.map(async (path) => {
    const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 15 * 60);
    return [path, data?.signedUrl ?? ""] as const;
  }));
  for (const [path, url] of urlResults) if (url) imageUrls.set(path, url);

  const cards: MarketplaceProduct[] = products.map((product) => {
    const seller = sellerById.get(product.seller_id);
    const imagePath = firstImageByProduct.get(product.id);
    return {
      ...product,
      categoryName: categoryNames.get(product.category_id) ?? "Campus finds",
      sellerName: seller?.full_name ?? "Verified member",
      sellerHandle: seller?.handle ?? "member",
      imageUrl: imagePath ? imageUrls.get(imagePath) ?? null : null,
    };
  });
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const pickupName = (pickupData?.[0] as { name?: string } | undefined)?.name;

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85">
        <div className="mx-auto flex min-h-[74px] max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Marketplace</span></Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link className="hidden rounded-full px-3 py-2 text-[#625b6b] hover:bg-violet-50 hover:text-violet-900 sm:inline-flex" href="/orders">Orders</Link>
            <Link className="hidden rounded-full px-3 py-2 text-[#625b6b] hover:bg-violet-50 hover:text-violet-900 sm:inline-flex" href="/messages">Messages</Link>
            <Link className="hidden rounded-full px-3 py-2 text-[#625b6b] hover:bg-violet-50 hover:text-violet-900 sm:inline-flex" href="/notifications">Alerts{unreadCount ? ` · ${unreadCount}` : ""}</Link>
            <Link className="hidden rounded-full px-3 py-2 text-[#625b6b] hover:bg-violet-50 hover:text-violet-900 sm:inline-flex" href="/wishlist">Wishlist</Link>
            <Link className="hidden rounded-full px-3 py-2 text-[#625b6b] hover:bg-violet-50 hover:text-violet-900 lg:inline-flex" href="/dashboard">Studio</Link>
            <Link className="hidden rounded-full px-3 py-2 text-[#625b6b] hover:bg-violet-50 hover:text-violet-900 sm:inline-flex" href="/profile">Profile</Link>
            {profile.role === "college_admin" || profile.role === "super_admin" ? <Link className="hidden rounded-full px-3 py-2 text-[#625b6b] hover:bg-violet-50 hover:text-violet-900 sm:inline-flex" href="/admin">Admin</Link> : null}
            <Link className="inline-flex min-h-10 items-center rounded-full bg-violet-950 px-4 text-xs font-semibold text-white transition hover:bg-violet-900" href="/listings/new">List an item <span className="ml-1">+</span></Link>
            <form action={signOut}><button className="hidden min-h-10 rounded-full px-3 text-xs font-semibold text-[#77717e] hover:text-violet-950 sm:inline-flex" type="submit">Sign out</button></form>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-violet-700"><ShieldCheck size={14} /> Verified campus exchange</p>
            <h1 className="mt-3 font-serif text-4xl tracking-[-.055em] text-[#28232f] sm:text-5xl">Find it in your loop.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#77717e]">Browse items shared by verified members of your college community.</p>
          </div>
          {pickupName ? <p className="rounded-full border border-[#e8e3ec] bg-white px-4 py-2.5 text-xs text-[#696270]">Campus pickup · <b className="text-[#3e3748]">{pickupName}</b></p> : null}
        </div>

        <form className="mt-8 grid gap-3 rounded-[22px] border border-[#e8e5e2] bg-white p-3 shadow-[0_15px_40px_-35px_rgba(43,29,68,.45)] sm:grid-cols-[minmax(0,1fr)_180px_130px_130px_150px_auto] sm:items-center">
          <label className="relative block min-w-0"><span className="sr-only">Search products</span><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#928b96]" size={16} /><input className="h-11 w-full rounded-full bg-[#f8f7f8] pl-10 pr-4 text-sm outline-none transition focus:ring-4 focus:ring-violet-100" type="search" name="q" defaultValue={search} placeholder="Search the campus marketplace" /></label>
          <label><span className="sr-only">Filter by category</span><select className="h-11 w-full rounded-full bg-[#f8f7f8] px-4 text-sm text-[#504a57] outline-none focus:ring-4 focus:ring-violet-100" name="category" defaultValue={categoryId}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label><span className="sr-only">Minimum price</span><input className="h-11 w-full rounded-full bg-[#f8f7f8] px-4 text-sm outline-none focus:ring-4 focus:ring-violet-100" name="min" type="number" min="0" step="1" placeholder="Min ₹" defaultValue={first(params.min) ?? ""} /></label>
          <label><span className="sr-only">Maximum price</span><input className="h-11 w-full rounded-full bg-[#f8f7f8] px-4 text-sm outline-none focus:ring-4 focus:ring-violet-100" name="max" type="number" min="0" step="1" placeholder="Max ₹" defaultValue={first(params.max) ?? ""} /></label>
          <label><span className="sr-only">Sort products</span><select className="h-11 w-full rounded-full bg-[#f8f7f8] px-4 text-sm text-[#504a57] outline-none focus:ring-4 focus:ring-violet-100" name="sort" defaultValue={sort}><option value="recent">Recently added</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option></select></label>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-violet-950 px-5 text-sm font-semibold text-white transition hover:bg-violet-900" type="submit"><SlidersHorizontal size={15} /> Filter</button>
        </form>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#77717e]">{selectedCategory ? <><b className="text-[#403a47]">{selectedCategory.name}</b><span className="mx-2">·</span></> : null}{search ? <>Results for <b className="text-[#403a47]">“{search}”</b><span className="mx-2">·</span></> : null}{cards.length} {cards.length === 1 ? "item" : "items"}</p>
          <span className="text-[11px] font-medium text-[#928b96]">Verified listings · private to your campus</span>
        </div>
        {productsError ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">Marketplace data is not available. Check that the pilot schema and public Data API access are configured.</div>
        ) : cards.length ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((product) => <ProductCard key={product.id} product={product} saved={saved.has(product.id)} returnTo="/marketplace" currentUserId={userId} />)}
          </div>
        ) : (
          <div className="mt-5 rounded-[28px] border border-dashed border-[#d9d2e0] bg-white px-6 py-16 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6f3fa] text-violet-800"><Search size={21} /></span>
            <h2 className="mt-4 font-serif text-2xl text-[#28232f]">No listings match just yet.</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#77717e]">Try another search or check back when your campus community adds more items.</p>
            <Link className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-800 hover:text-violet-950" href="/listings/new">Have something to share? List an item <ArrowRight size={15} /></Link>
          </div>
        )}
      </section>
    </main>
  );
}
