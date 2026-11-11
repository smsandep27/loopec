import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, MapPin, MessageCircle, ShieldCheck, Zap } from "lucide-react";
import { notFound } from "next/navigation";
import { FormNotice } from "@/components/auth/auth-shell";
import { authMessage } from "@/lib/auth/messages";
import { requireApprovedMember } from "@/lib/auth/member";
import { signOut } from "@/app/auth/actions";
import { submitOrderReview, submitPaymentReference, updateOrderStatus } from "@/app/orders/actions";
import { PayOnlineCard, PaymentReceiptCard } from "@/components/payments/pay-online-card";
import { calculateCommission } from "@/lib/payments/commission";

export const instant = false;

type Order = {
  id: string;
  buyer_id: string;
  seller_id: string;
  college_id: string;
  pickup_location_id: string | null;
  status: string;
  subtotal: number | string;
  commission_amount: number | string;
  total_amount: number | string;
  currency: string;
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
  created_at: string;
};
type OrderItem = { id: string; product_name: string; unit_price: number | string; quantity: number; line_total: number | string };
type Payment = { id: string; method: string; provider?: string; status: string; amount: number | string; provider_payment_id: string | null; review_note: string | null; verified_at: string | null };
const statusLabels: Record<string, string> = {
  pending: "Waiting for seller",
  accepted: "Accepted",
  rejected: "Declined",
  payment_pending: "Payment pending",
  paid: "Paid & Secured",
  ready_for_pickup: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function OrderDetailsPage({ params, searchParams }: PageProps<"/orders/[orderId]">) {
  const [{ orderId }, paramsData] = await Promise.all([params, searchParams]);
  const errorCode = Array.isArray(paramsData.error) ? paramsData.error[0] : paramsData.error;
  const { supabase, userId } = await requireApprovedMember();
  const { data: orderData } = await supabase.from("orders").select("id, buyer_id, seller_id, college_id, pickup_location_id, status, subtotal, commission_amount, total_amount, currency, buyer_confirmed_at, seller_confirmed_at, created_at").eq("id", orderId).maybeSingle();
  if (!orderData) notFound();
  const order = orderData as Order;
  const buyerView = order.buyer_id === userId;
  if (!buyerView && order.seller_id !== userId && process.env.LOOPEC_DEV_BYPASS_AUTH !== "true") notFound();
  const otherId = buyerView ? order.seller_id : order.buyer_id;
  const [{ data: itemData }, { data: paymentData }, { data: personData }, { data: pickupData }, { data: conversationData }, { data: reviewData }] = await Promise.all([
    supabase.from("order_items").select("id, product_name, unit_price, quantity, line_total").eq("order_id", order.id),
    supabase.from("payments").select("id, method, provider, status, amount, provider_payment_id, review_note, verified_at").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("id, full_name, handle").eq("id", otherId).maybeSingle(),
    order.pickup_location_id ? supabase.from("pickup_locations").select("id, name, address, instructions").eq("id", order.pickup_location_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("conversations").select("id").eq("order_id", order.id).maybeSingle(),
    supabase.from("reviews").select("id, rating, comment").eq("order_id", order.id).eq("reviewer_id", userId).maybeSingle(),
  ]);
  const items = (itemData ?? []) as OrderItem[];
  const payment = paymentData as Payment | null;
  const person = personData as { id: string; full_name: string; handle: string } | null;
  const pickup = pickupData as { id: string; name: string; address: string; instructions: string } | null;
  const conversation = conversationData as { id: string } | null;
  const review = reviewData as { id: string; rating: number; comment: string } | null;
  const errorMessage = errorCode ? authMessage(errorCode) : null;
  const otherConfirmed = buyerView ? order.seller_confirmed_at : order.buyer_confirmed_at;
  const ownConfirmed = buyerView ? order.buyer_confirmed_at : order.seller_confirmed_at;
  const title = statusLabels[order.status] ?? order.status;
  const isPaid = order.status === "paid" || ["ready_for_pickup", "completed"].includes(order.status) || payment?.status === "paid";
  const commission = calculateCommission(order.total_amount, 5);

  return (
    <main className="min-h-screen bg-[#f7f6f4]">
      <header className="border-b border-[#e8e5e2] bg-white/85">
        <div className="mx-auto flex min-h-[72px] max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/marketplace" className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC</Link>
          <div className="flex items-center gap-4">
            <Link href="/orders" className="text-xs font-semibold text-violet-800">All orders</Link>
            <form action={signOut}><button type="submit" className="text-xs font-semibold text-[#77717e]">Sign out</button></form>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-11">
        <Link href="/orders" className="inline-flex items-center gap-2 text-xs font-semibold text-[#77717e] hover:text-violet-900"><ArrowLeft size={14} /> Orders</Link>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">{buyerView ? "Buyer order" : "Seller order"}</p>
            <h1 className="mt-2 font-serif text-4xl tracking-[-.05em] text-[#28232f]">{title}</h1>
            <p className="mt-2 text-xs text-[#89828e]">Placed {new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <span className={`rounded-full px-3 py-2 text-xs font-semibold ${isPaid ? "bg-emerald-50 text-emerald-800" : ["rejected", "cancelled", "refunded"].includes(order.status) ? "bg-[#efedef] text-[#625b68]" : "bg-violet-50 text-violet-800"}`}>
            {title}
          </span>
        </div>
        <div className="mt-6 space-y-4">
          {errorMessage ? <FormNotice>{errorMessage}</FormNotice> : null}
          {paramsData.paid ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">⚡ Payment verified successfully! Your order is secured in campus escrow.</p> : null}
          {paramsData.updated ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Order status updated.</p> : null}
          {paramsData.reference_submitted ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Payment reference submitted for verification.</p> : null}

          {/* Online Payment Card (When accepted / awaiting payment) */}
          {buyerView && ["accepted", "payment_pending"].includes(order.status) && !isPaid ? (
            <PayOnlineCard
              orderId={order.id}
              amount={Number(order.total_amount)}
              currency={order.currency}
              buyerName={person?.full_name}
            />
          ) : null}

          {/* Paid Receipt Card */}
          {isPaid ? (
            <PaymentReceiptCard
              orderId={order.id}
              amount={Number(order.total_amount)}
              paymentMethod={payment?.provider === "razorpay" ? "Razorpay Online" : payment?.method === "online" ? "Online Instant" : "UPI"}
              referenceId={payment?.provider_payment_id}
              verifiedAt={payment?.verified_at}
            />
          ) : null}

          {/* Order Items & 5% Platform Fee Transparency */}
          <article className="rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-[#383240]">Order items</h2>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div className="flex items-center gap-3 border-t border-[#f0edf0] pt-3 first:border-0 first:pt-0" key={item.id}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-800">{buyerView ? "↗" : "↙"}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm text-[#3c3643]">{item.product_name}</b>
                    <small className="mt-1 block text-xs text-[#89828e]">{currency.format(Number(item.unit_price))} × {item.quantity}</small>
                  </span>
                  <b className="text-sm text-[#3c3643]">{currency.format(Number(item.line_total))}</b>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-[#eeeaf0] pt-4 space-y-2 text-xs text-[#77717e]">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <b className="text-[#302b37]">{currency.format(Number(order.total_amount))}</b>
              </div>
              <div className="flex justify-between">
                <span>LOOPEC Platform Commission (5%)</span>
                <b className="text-violet-800">{commission.formatted.commissionAmount}</b>
              </div>
              <div className="flex justify-between">
                <span>Seller Net Proceeds (95%)</span>
                <b className="text-[#4b4353]">{commission.formatted.sellerNetAmount}</b>
              </div>
              <div className="border-t border-[#f0edf0] pt-2 flex justify-between text-sm">
                <span className="font-semibold text-[#302b37]">Total Amount</span>
                <b className="font-bold text-[#302b37]">{currency.format(Number(order.total_amount))}</b>
              </div>
            </div>
          </article>

          {/* Campus Pickup Location */}
          {pickup ? (
            <article className="rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[#383240]"><MapPin size={16} className="text-violet-800" /> Campus pickup</h2>
              <p className="mt-3 text-sm font-semibold text-[#3d3744]">{pickup.name}</p>
              <p className="mt-1 text-sm text-[#77717e]">{pickup.address}</p>
              {pickup.instructions ? <p className="mt-2 text-xs leading-5 text-[#89828e]">{pickup.instructions}</p> : null}
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-950">
                <Clock3 size={15} className="shrink-0" /> Coordinate an exact meeting time with {person?.full_name ?? (buyerView ? "the seller" : "the buyer")} in Messages.
              </div>
            </article>
          ) : null}

          {/* Optional Manual UPI Transfer (Expandable) */}
          {!isPaid && (
            <details className="rounded-[22px] border border-[#e8e5e2] bg-white p-5 text-xs text-[#77717e]">
              <summary className="cursor-pointer font-semibold text-[#383240] hover:text-violet-900">
                Prefer manual UPI bank transfer reference?
              </summary>
              <div className="mt-3 space-y-3 border-t border-[#eeeaf0] pt-3">
                <p>If you transferred funds directly to the seller via your bank app, enter the transaction reference number below for admin verification.</p>
                {buyerView && ["accepted", "payment_pending"].includes(order.status) ? (
                  <form action={submitPaymentReference} className="mt-3 space-y-3">
                    <input type="hidden" name="order_id" value={order.id} />
                    <label className="block text-xs font-semibold text-[#625b6b]">
                      UPI transaction reference
                      <input className="mt-2 min-h-12 w-full rounded-xl border border-[#e4e0e8] px-3.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="payment_reference" inputMode="text" autoComplete="off" pattern="[A-Za-z0-9-]{6,50}" minLength={6} maxLength={50} required placeholder="Reference from your UPI app" />
                    </label>
                    <button className="min-h-11 rounded-full bg-violet-950 px-5 text-sm font-semibold text-white hover:bg-violet-900" type="submit">Submit reference for review</button>
                  </form>
                ) : null}
              </div>
            </details>
          )}

          {/* Message Link */}
          {conversation ? (
            <Link className="flex items-center justify-between rounded-[22px] border border-[#e8e5e2] bg-white p-5 transition hover:border-violet-200" href={`/messages/${conversation.id}`}>
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-800"><MessageCircle size={18} /></span>
                <span>
                  <b className="block text-sm text-[#383240]">Message {person?.full_name ?? "member"}</b>
                  <small className="mt-1 block text-xs text-[#89828e]">Private coordination for this order</small>
                </span>
              </span>
              <span className="text-xs font-semibold text-violet-800">Open messages</span>
            </Link>
          ) : null}

          {/* Campus Handover Confirmation */}
          {order.status === "ready_for_pickup" ? (
            <article className="rounded-[22px] border border-violet-200 bg-violet-50 p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-violet-950">Confirm the campus handover</h2>
              <p className="mt-2 text-xs leading-5 text-violet-900">The order completes after both buyer and seller confirm pickup.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <p className="flex items-center gap-2 text-xs text-violet-950">{order.buyer_confirmed_at ? <CheckCircle2 size={15} /> : <Clock3 size={15} />} Buyer {order.buyer_confirmed_at ? "confirmed" : "confirmation pending"}</p>
                <p className="flex items-center gap-2 text-xs text-violet-950">{order.seller_confirmed_at ? <CheckCircle2 size={15} /> : <Clock3 size={15} />} Seller {order.seller_confirmed_at ? "confirmed" : "confirmation pending"}</p>
              </div>
              {!ownConfirmed ? (
                <form action={updateOrderStatus} className="mt-4">
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="next_status" value="completed" />
                  <button className="min-h-11 rounded-full bg-violet-950 px-5 text-sm font-semibold text-white hover:bg-violet-900" type="submit">I confirm the pickup</button>
                </form>
              ) : !otherConfirmed ? (
                <p className="mt-4 text-xs font-semibold text-violet-900">Your confirmation is saved. Waiting for the other participant.</p>
              ) : null}
            </article>
          ) : null}

          {/* Initial Pending Actions */}
          {order.status === "pending" ? (
            <article className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#e8e5e2] bg-white p-5">
              <div>
                <p className="text-sm font-semibold text-[#383240]">{buyerView ? "Waiting for seller response" : `Order from ${person?.full_name ?? "a member"}`}</p>
                <p className="mt-1 text-xs text-[#89828e]">{buyerView ? "The seller will accept or decline this request." : "Review the items and then accept or decline the order."}</p>
              </div>
              <div className="flex gap-2">
                {!buyerView ? (
                  <>
                    <form action={updateOrderStatus}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <input type="hidden" name="next_status" value="accepted" />
                      <button className="min-h-10 rounded-full bg-violet-950 px-4 text-xs font-semibold text-white hover:bg-violet-900" type="submit">Accept</button>
                    </form>
                    <form action={updateOrderStatus}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <input type="hidden" name="next_status" value="rejected" />
                      <button className="min-h-10 rounded-full border border-rose-200 px-4 text-xs font-semibold text-rose-800 hover:bg-rose-50" type="submit">Decline</button>
                    </form>
                  </>
                ) : null}
                {buyerView ? (
                  <form action={updateOrderStatus}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <input type="hidden" name="next_status" value="cancelled" />
                    <button className="min-h-10 rounded-full border border-[#e4e0e8] px-4 text-xs font-semibold text-[#625b68] hover:bg-[#f7f5f8]" type="submit">Cancel request</button>
                  </form>
                ) : null}
              </div>
            </article>
          ) : null}

          {/* Seller Paid Action: Mark Ready for Pickup */}
          {order.status === "paid" && !buyerView ? (
            <article className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-950">Payment verified & escrowed</p>
              <p className="mt-2 text-xs leading-5 text-emerald-900">Your net payout ({commission.formatted.sellerNetAmount}) is secured. Prepare the item and arrange pickup.</p>
              <form action={updateOrderStatus} className="mt-4">
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="next_status" value="ready_for_pickup" />
                <button className="min-h-11 rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" type="submit">Mark ready for campus pickup</button>
              </form>
            </article>
          ) : null}

          {/* Completed Rating */}
          {order.status === "completed" ? (
            <article className="rounded-[22px] border border-[#e8e5e2] bg-white p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-[#383240]">Rate this campus exchange</h2>
              {review ? (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-violet-900">{review.rating} out of 5</p>
                  {review.comment ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#77717e]">{review.comment}</p> : null}
                </div>
              ) : (
                <form action={submitOrderReview} className="mt-4 space-y-3">
                  <input type="hidden" name="order_id" value={order.id} />
                  <label className="block text-xs font-semibold text-[#625b6b]">
                    Your rating
                    <select className="mt-2 min-h-11 w-full rounded-xl border border-[#e4e0e8] bg-white px-3.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="rating" defaultValue="5">
                      <option value="5">5 · Excellent</option>
                      <option value="4">4 · Good</option>
                      <option value="3">3 · Okay</option>
                      <option value="2">2 · Needs work</option>
                      <option value="1">1 · Poor</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[#625b6b]">
                    Comment <span className="font-normal">(optional)</span>
                    <textarea className="mt-2 min-h-20 w-full resize-y rounded-xl border border-[#e4e0e8] p-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="comment" maxLength={1200} />
                  </label>
                  <button className="min-h-10 rounded-full bg-violet-950 px-4 text-sm font-semibold text-white" type="submit">Submit review</button>
                </form>
              )}
            </article>
          ) : null}
        </div>
      </section>
    </main>
  );
}
