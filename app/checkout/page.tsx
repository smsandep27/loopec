import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin, ShieldCheck } from "lucide-react";
import { AuthShell, FormNotice } from "@/components/auth/auth-shell";
import { requireApprovedMember } from "@/lib/auth/member";
import { authMessage } from "@/lib/auth/messages";
import { createOrders } from "@/app/checkout/actions";
import { signOut } from "@/app/auth/actions";
import { calculateCommission } from "@/lib/payments/commission";

export const instant = false;

type CartLine = { product_id: string; quantity: number };
type Product = { id: string; seller_id: string; category_id: string; name: string; price: number | string; quantity: number; status: string };
type Pickup = { id: string; name: string; address: string; instructions: string };
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const quickProductId = Array.isArray(params.product_id) ? params.product_id[0] : params.product_id;
  const { supabase, userId, profile } = await requireApprovedMember();
  const [{ data: cartData }, { data: pickupData }] = await Promise.all([
    supabase.from("cart_items").select("product_id, quantity").eq("user_id", userId),
    profile.college_id ? supabase.from("pickup_locations").select("id, name, address, instructions").eq("college_id", profile.college_id).eq("is_active", true).order("sort_order") : Promise.resolve({ data: [] }),
  ]);
  let lines = (cartData ?? []) as CartLine[];
  const buyNowProductId = quickProductId && isUuid(quickProductId) ? quickProductId : null;
  if (buyNowProductId) lines = [{ product_id: buyNowProductId, quantity: 1 }];
  if (!lines.length) return <AuthShell eyebrow="Checkout" title="Your cart is empty" description="Add a listing before you begin checkout." footer={<Link className="font-semibold text-violet-800" href="/marketplace">Back to marketplace</Link>}><Link className="inline-flex min-h-11 items-center rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" href="/cart">View your cart</Link></AuthShell>;
  const productIds = lines.map((line) => line.product_id);
  const [{ data: productData }, { data: sellerData }] = await Promise.all([
    supabase.from("products").select("id, seller_id, category_id, name, price, quantity, status").in("id", productIds),
    Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const products = new Map(((productData ?? []) as Product[]).map((product) => [product.id, product]));
  const sellerIds = [...new Set([...products.values()].map((product) => product.seller_id))];
  const { data: sellerRows } = sellerIds.length ? await supabase.from("profiles").select("id, full_name").in("id", sellerIds) : { data: sellerData };
  const sellers = new Map(((sellerRows ?? []) as { id: string; full_name: string }[]).map((seller) => [seller.id, seller.full_name]));
  const { data: imagesData } = productIds.length ? await supabase.from("product_images").select("product_id, storage_path, sort_order").in("product_id", productIds).order("sort_order") : { data: [] };
  const paths = new Map<string, string>();
  for (const image of (imagesData ?? []) as { product_id: string; storage_path: string; sort_order: number }[]) if (!paths.has(image.product_id)) paths.set(image.product_id, image.storage_path);
  const signed = await Promise.all([...paths.entries()].map(async ([id, path]) => {
    const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 15 * 60);
    return [id, data?.signedUrl ?? null] as const;
  }));
  const images = new Map(signed);
  const pickupPoints = (pickupData ?? []) as Pickup[];
  const unavailable = lines.some((line) => {
    const product = products.get(line.product_id);
    return !product || product.status !== "approved" || product.quantity < line.quantity;
  });
  const groups = new Map<string, { items: { line: CartLine; product: Product }[]; total: number }>();
  for (const line of lines) {
    const product = products.get(line.product_id);
    if (!product) continue;
    const group = groups.get(product.seller_id) ?? { items: [], total: 0 };
    group.items.push({ line, product });
    group.total += Number(product.price) * line.quantity;
    groups.set(product.seller_id, group);
  }
  const grandTotal = [...groups.values()].reduce((acc, g) => acc + g.total, 0);
  const commission = calculateCommission(grandTotal, 5);
  const errorMessage = errorCode ? authMessage(errorCode) : null;

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85"><div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8"><Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Checkout</span></Link><form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form></div></header>
      <section className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <Link href="/cart" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Back to cart</Link>
        <div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Secure campus exchange</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">Confirm your pickup</h1><p className="mt-2 text-sm leading-6 text-[#77717e]">Your items are rechecked and reserved together when you place the order.</p></div>
        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {errorMessage ? <FormNotice>{errorMessage}</FormNotice> : null}
            {unavailable ? <FormNotice>One or more cart items changed or sold. Return to your cart and remove unavailable items before checkout.</FormNotice> : null}
            <section className="rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:p-6"><h2 className="flex items-center gap-2 text-sm font-semibold text-[#383240]"><MapPin size={16} className="text-violet-800" /> Campus pickup point</h2>{pickupPoints.length ? <div className="mt-4 space-y-3">{pickupPoints.map((point, index) => <label className="flex cursor-pointer gap-3 rounded-2xl border border-[#e9e5ec] p-4 has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50" key={point.id}><input className="mt-1 accent-violet-900" type="radio" name="pickup_location_id" form="place-order" value={point.id} required defaultChecked={index === 0} /><span><b className="block text-sm text-[#383240]">{point.name}</b><span className="mt-1 block text-xs leading-5 text-[#817a87]">{point.address}</span>{point.instructions ? <small className="mt-1 block text-xs text-[#918b96]">{point.instructions}</small> : null}</span></label>)}</div> : <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950">No active pickup points are configured. Ask your college admin to add one before placing orders.</p>}</section>
            <section className="rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:p-6"><h2 className="text-sm font-semibold text-[#383240]">Items by seller</h2><div className="mt-4 space-y-5">{[...groups.entries()].map(([sellerId, group]) => <div className="border-t border-[#f0edf0] pt-4 first:border-0 first:pt-0" key={sellerId}><p className="text-xs font-semibold text-violet-800">{sellers.get(sellerId) ?? "Verified member"} · {group.items.length} item{group.items.length === 1 ? "" : "s"}</p><div className="mt-3 space-y-3">{group.items.map(({ line, product }) => <div className="flex items-center gap-3" key={product.id}><span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-[#f0edf3]">{images.get(product.id) ? <Image src={images.get(product.id)!} alt={product.name} fill sizes="48px" unoptimized className="object-cover" /> : null}</span><span className="min-w-0 flex-1 truncate text-sm text-[#57505e]">{product.name} <span className="text-[#958e99]">× {line.quantity}</span></span><b className="text-sm text-[#383240]">{currency.format(Number(product.price) * line.quantity)}</b></div>)}</div><p className="mt-3 border-t border-[#f0edf0] pt-3 text-right text-xs text-[#817a87]">Order subtotal <b className="ml-2 text-[#383240]">{currency.format(group.total)}</b></p></div>)}</div></section>
          </div>
          <aside className="h-fit rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#302b37]">Payment & Pickup</h2>
            <div className="mt-4 flex gap-3 rounded-2xl bg-violet-50 p-4">
              <ShieldCheck className="mt-0.5 shrink-0 text-violet-800" size={18} />
              <p className="text-xs leading-5 text-violet-950">
                <b>Secure Campus Online Payments.</b> Pay online via UPI (GPay, PhonePe, Paytm), Cards, or NetBanking upon seller confirmation. LOOPEC charges a transparent 5% platform fee to maintain college operations.
              </p>
            </div>
            
            <div className="mt-4 rounded-xl border border-[#eeeaf0] bg-[#faf9fa] p-3.5 space-y-2 text-xs text-[#71687d]">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <b className="text-[#302546]">{commission.formatted.subtotal}</b>
              </div>
              <div className="flex justify-between">
                <span>Platform Commission (5%)</span>
                <b className="text-violet-800">{commission.formatted.commissionAmount}</b>
              </div>
              <div className="flex justify-between">
                <span>Seller Net Handover</span>
                <span className="text-[#554d5e]">{commission.formatted.sellerNetAmount}</span>
              </div>
              <div className="border-t border-[#eae5ee] pt-2 flex justify-between text-sm font-bold text-[#302546]">
                <span>Total Amount</span>
                <span>{commission.formatted.totalAmount}</span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-[#85808a]">{buyNowProductId ? "This checkout covers the selected item only. It will not change your saved cart." : "This checkout creates a separate order for each seller. Your cart is cleared after the orders are placed."}</p>
            <form id="place-order" action={createOrders} className="mt-5"><input type="hidden" name="idempotency_key" value={crypto.randomUUID()} />{buyNowProductId ? <input type="hidden" name="product_id" value={buyNowProductId} /> : null}<button className="min-h-12 w-full rounded-full bg-violet-950 px-5 text-sm font-semibold text-white transition hover:bg-violet-900 disabled:pointer-events-none disabled:bg-violet-300" type="submit" disabled={!pickupPoints.length || unavailable}>{buyNowProductId ? "Buy now" : `Place order${groups.size > 1 ? "s" : ""}`}</button></form>
            <Link className="mt-3 block text-center text-xs font-semibold text-violet-800 hover:text-violet-950" href="/cart">Review cart</Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
