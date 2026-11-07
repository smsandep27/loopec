import Link from "next/link";
import { ArrowLeft, BadgeCheck, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductCard, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { requireApprovedMember } from "@/lib/auth/member";

export const instant = false;

type Product = { id: string; seller_id: string; category_id: string; name: string; description: string; price: number | string; item_condition: MarketplaceProduct["item_condition"]; quantity: number; is_featured: boolean; published_at: string | null };

export default async function MemberPage({ params }: PageProps<"/members/[handle]">) {
  const { handle } = await params;
  const { supabase, userId, profile } = await requireApprovedMember();
  const { data: memberData } = await supabase.from("profiles").select("id, full_name, handle, bio, role, verification_status, college_id, created_at").eq("handle", handle).eq("college_id", profile.college_id ?? "00000000-0000-0000-0000-000000000000").eq("verification_status", "approved").is("suspended_at", null).maybeSingle();
  if (!memberData) notFound();
  const member = memberData as { id: string; full_name: string; handle: string; bio: string | null; role: string; verification_status: string; college_id: string; created_at: string };
  const [{ data: productData }, { data: reviewData }] = await Promise.all([
    supabase.from("products").select("id, seller_id, category_id, name, description, price, item_condition, quantity, is_featured, published_at").eq("seller_id", member.id).eq("status", "approved").gt("quantity", 0).order("published_at", { ascending: false, nullsFirst: false }).limit(40),
    supabase.from("reviews").select("rating").eq("reviewed_user_id", member.id).limit(100),
  ]);
  const products = (productData ?? []) as Product[];
  const categoryIds = [...new Set(products.map((item) => item.category_id))];
  const ids = products.map((item) => item.id);
  const [{ data: categoryData }, { data: imageData }, { data: savedData }] = await Promise.all([
    categoryIds.length ? supabase.from("categories").select("id, name").in("id", categoryIds) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("product_images").select("product_id, storage_path, sort_order").in("product_id", ids).order("sort_order") : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("wishlists").select("product_id").eq("user_id", userId).in("product_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const categories = new Map(((categoryData ?? []) as { id: string; name: string }[]).map((item) => [item.id, item.name]));
  const paths = new Map<string, string>();
  for (const image of (imageData ?? []) as { product_id: string; storage_path: string; sort_order: number }[]) if (!paths.has(image.product_id)) paths.set(image.product_id, image.storage_path);
  const signed = await Promise.all([...paths.entries()].map(async ([id, path]) => {
    const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 15 * 60);
    return [id, data?.signedUrl ?? null] as const;
  }));
  const images = new Map(signed);
  const saved = new Set((savedData ?? []).map((item) => (item as { product_id: string }).product_id));
  const cards: MarketplaceProduct[] = products.map((item) => ({ ...item, categoryName: categories.get(item.category_id) ?? "Campus finds", sellerName: member.full_name, sellerHandle: member.handle, imageUrl: images.get(item.id) ?? null }));
  const ratings = (reviewData ?? []).map((item) => Number((item as { rating: number }).rating));
  const avg = ratings.length ? ratings.reduce((total, value) => total + value, 0) / ratings.length : null;
  const role = member.role === "faculty" ? "Faculty" : member.role === "staff" ? "College staff" : "Student";

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85"><div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8"><Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC <span className="ml-2 font-normal tracking-normal text-[#8b8590]">Member</span></Link><Link href="/messages" className="text-xs font-semibold text-violet-800">Messages</Link></div></header>
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Marketplace</Link>
        <article className="mt-6 rounded-[28px] border border-[#e8e5e2] bg-white p-6 sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="grid size-20 shrink-0 place-items-center rounded-[26px] bg-violet-50 font-serif text-4xl text-violet-800">{member.full_name.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Verified campus member</p><h1 className="mt-2 flex flex-wrap items-center gap-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">{member.full_name}<BadgeCheck className="text-violet-700" size={22} /></h1><p className="mt-2 text-sm text-[#77717e]">{role} · @{member.handle}</p>{member.bio ? <p className="mt-4 max-w-2xl text-sm leading-6 text-[#716b77]">{member.bio}</p> : null}</div>
            <div className="flex items-center gap-3 rounded-2xl bg-[#f8f7f8] px-4 py-3"><Star size={17} className="fill-violet-200 text-violet-700" /><span><b className="block text-sm text-[#383240]">{avg ? `${avg.toFixed(1)} / 5` : "New seller"}</b><small className="text-xs text-[#85808a]">{ratings.length ? `${ratings.length} reviews` : "No reviews yet"}</small></span></div>
          </div>
        </article>
        <div className="mt-10 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Marketplace</p><h2 className="mt-2 font-serif text-3xl tracking-[-.04em] text-[#28232f]">{member.id === userId ? "Your active listings" : `${member.full_name.split(" ")[0]}’s listings`}</h2></div><span className="text-xs text-[#8b8590]">{cards.length} available</span></div>
        {cards.length ? <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cards.map((item) => <ProductCard key={item.id} product={item} saved={saved.has(item.id)} currentUserId={userId} returnTo={`/members/${member.handle}`} />)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-[#d9d2e0] bg-white px-5 py-12 text-center text-sm text-[#77717e]">No active listings at the moment.</p>}
      </section>
    </main>
  );
}
