import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, ShoppingBag, Trash2 } from "lucide-react";
import { requireApprovedMember } from "@/lib/auth/member";
import { authMessage } from "@/lib/auth/messages";
import { removeCartItem, updateCartQuantity } from "@/app/cart/actions";
import { signOut } from "@/app/auth/actions";

export const instant = false;

type CartLine = { product_id: string; quantity: number };
type CartProduct = { id: string; seller_id: string; category_id: string; name: string; price: number | string; quantity: number; item_condition: "new" | "like_new" | "good" | "used"; status: string };
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function CartPage({ searchParams }: PageProps<"/cart">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const added = Boolean(params.added);
  const { supabase, userId } = await requireApprovedMember();
  const { data: lineData } = await supabase.from("cart_items").select("product_id, quantity").eq("user_id", userId).order("created_at", { ascending: true });
  const lines = (lineData ?? []) as CartLine[];
  const productIds = lines.map((line) => line.product_id);
  const { data: productData } = productIds.length
    ? await supabase.from("products").select("id, seller_id, category_id, name, price, quantity, item_condition, status").in("id", productIds)
    : { data: [] };
  const products = new Map(((productData ?? []) as CartProduct[]).map((product) => [product.id, product]));
  const visible = (productData ?? []) as CartProduct[];
  const categoryIds = [...new Set(visible.map((product) => product.category_id))];
  const sellerIds = [...new Set(visible.map((product) => product.seller_id))];
  const visibleIds = visible.map((product) => product.id);
  const [{ data: categoriesData }, { data: sellersData }, { data: imageData }] = await Promise.all([
    categoryIds.length ? supabase.from("categories").select("id, name").in("id", categoryIds) : Promise.resolve({ data: [] }),
    sellerIds.length ? supabase.from("profiles").select("id, full_name, handle").in("id", sellerIds) : Promise.resolve({ data: [] }),
    visibleIds.length ? supabase.from("product_images").select("product_id, storage_path, sort_order").in("product_id", visibleIds).order("sort_order") : Promise.resolve({ data: [] }),
  ]);
  const categoryNames = new Map(((categoriesData ?? []) as { id: string; name: string }[]).map((item) => [item.id, item.name]));
  const sellers = new Map(((sellersData ?? []) as { id: string; full_name: string; handle: string }[]).map((item) => [item.id, item]));
  const imagePaths = new Map<string, string>();
  for (const image of (imageData ?? []) as { product_id: string; storage_path: string; sort_order: number }[]) if (!imagePaths.has(image.product_id)) imagePaths.set(image.product_id, image.storage_path);
  const urls = await Promise.all([...imagePaths.entries()].map(async ([id, path]) => {
    const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 15 * 60);
    return [id, data?.signedUrl ?? null] as const;
  }));
  const imageUrls = new Map(urls);
  const subtotal = lines.reduce((sum, line) => {
    const product = products.get(line.product_id);
    if (!product || product.status !== "approved" || product.quantity < line.quantity) return sum;
    return sum + Number(product.price) * line.quantity;
  }, 0);
  const unavailable = lines.filter((line) => {
    const product = products.get(line.product_id);
    return !product || product.status !== "approved" || product.quantity < line.quantity;
  });

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85"><div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8"><Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Your cart</span></Link><form action={signOut}><button className="text-xs font-semibold text-[#77717e] hover:text-violet-900" type="submit">Sign out</button></form></div></header>
      <section className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Keep browsing</Link>
        <div className="mt-5 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Campus finds</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Your cart</h1></div><span className="text-sm text-[#817a87]">{lines.length} {lines.length === 1 ? "item" : "items"}</span></div>
        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-3">
            {authMessage(errorCode) ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{authMessage(errorCode) === "Check the details and try again." ? "The quantity changed or there is not enough stock. Review the item and try again." : authMessage(errorCode)}</p> : null}
            {added ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Added to your cart. Check availability again before checkout.</p> : null}
            {unavailable.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950">Some items changed or sold while in your cart. Remove those lines before checkout.</p> : null}
            {lines.length ? lines.map((line) => {
              const product = products.get(line.product_id);
              const seller = product ? sellers.get(product.seller_id) : null;
              const image = imageUrls.get(line.product_id);
              const active = product?.status === "approved" && product.quantity >= line.quantity;
              return (
                <article className="flex gap-4 rounded-[22px] border border-[#e8e5e2] bg-white p-4 sm:p-5" key={line.product_id}>
                  <Link className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-[#f0edf3] sm:size-28" href={product ? `/marketplace/${product.id}` : "/marketplace"}>
                    {image ? <Image src={image} alt={product?.name ?? "Marketplace item"} fill sizes="112px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-violet-300"><ShoppingBag size={23} /></span>}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      {product ? <><p className="text-[10px] font-bold uppercase tracking-[.11em] text-violet-700">{categoryNames.get(product.category_id) ?? "Campus finds"}</p><Link href={`/marketplace/${product.id}`} className="mt-1 block truncate text-sm font-semibold text-[#36303d] hover:text-violet-800">{product.name}</Link><p className="mt-1 flex items-center gap-1 text-xs text-[#85808a]"><BadgeCheck size={13} className="text-violet-700" /> {seller?.full_name ?? "Verified member"}</p></> : <><p className="text-sm font-semibold text-[#36303d]">Listing no longer available</p><p className="mt-1 text-xs text-[#85808a]">Remove it to continue to checkout.</p></>}
                      {!active ? <p className="mt-2 text-xs font-semibold text-rose-700">Unavailable or insufficient stock</p> : null}
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <div className="flex items-center gap-2">
                        {product && active && line.quantity > 1 ? <form action={updateCartQuantity}><input type="hidden" name="product_id" value={line.product_id} /><input type="hidden" name="quantity" value={line.quantity - 1} /><button className="grid size-8 place-items-center rounded-full border border-[#e8e5e2] text-[#665e6d] hover:bg-violet-50" aria-label="Decrease quantity" type="submit">−</button></form> : null}
                        <span className="min-w-7 text-center text-sm font-semibold text-[#514a57]">{line.quantity}</span>
                        {product && active && line.quantity < product.quantity ? <form action={updateCartQuantity}><input type="hidden" name="product_id" value={line.product_id} /><input type="hidden" name="quantity" value={line.quantity + 1} /><button className="grid size-8 place-items-center rounded-full border border-[#e8e5e2] text-[#665e6d] hover:bg-violet-50" aria-label="Increase quantity" type="submit">+</button></form> : null}
                      </div>
                      <div className="flex items-center gap-3"><b className="whitespace-nowrap text-sm text-[#37313e]">{product ? currency.format(Number(product.price) * line.quantity) : "—"}</b><form action={removeCartItem}><input type="hidden" name="product_id" value={line.product_id} /><button className="grid size-8 place-items-center rounded-full text-[#99929c] hover:bg-rose-50 hover:text-rose-700" type="submit" aria-label="Remove from cart"><Trash2 size={15} /></button></form></div>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="rounded-[26px] border border-dashed border-[#d9d2e0] bg-white px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6f3fa] text-violet-800"><ShoppingBag size={22} /></span><h2 className="mt-4 font-serif text-2xl text-[#28232f]">Your cart is taking a breather.</h2><p className="mt-2 text-sm text-[#77717e]">Find something useful from your campus community.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" href="/marketplace">Browse listings</Link></div>
            )}
          </div>
          <aside className="h-fit rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#302b37]">Order summary</h2>
            <div className="mt-5 flex justify-between border-b border-[#f0edf0] pb-4 text-sm"><span className="text-[#77717e]">Items subtotal</span><b className="text-[#302b37]">{currency.format(subtotal)}</b></div>
            <p className="mt-4 text-xs leading-5 text-[#89828e]">Pickup details and current prices are confirmed at checkout. Each seller’s items may become a separate order.</p>
            <Link aria-disabled={!lines.length || unavailable.length > 0} className={`mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold text-white ${lines.length && !unavailable.length ? "bg-violet-950 hover:bg-violet-900" : "pointer-events-none bg-violet-300"}`} href="/checkout">Continue to checkout</Link>
            <Link className="mt-3 block text-center text-xs font-semibold text-violet-800 hover:text-violet-950" href="/marketplace">Continue shopping</Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
