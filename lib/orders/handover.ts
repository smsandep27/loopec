import crypto from "crypto";

/**
 * Generate a deterministic, cryptographically secure 4-digit Campus Handover PIN.
 * Derived from the order ID and secret key, ensuring only the buyer who views the order has it.
 */
export function getOrderHandoverPin(orderId: string): string {
  const secret = process.env.RAZORPAY_KEY_SECRET || "loopec-nitc-handover-salt-2026";
  const hash = crypto
    .createHmac("sha256", secret)
    .update(`handover-pin-${orderId}`)
    .digest("hex");
  const num = (parseInt(hash.slice(0, 8), 16) % 9000) + 1000;
  return num.toString();
}

/**
 * Validates the buyer's handover PIN submitted by the seller.
 */
export function verifyHandoverPin(orderId: string, enteredPin: string): boolean {
  if (!orderId || !enteredPin) return false;
  const expected = getOrderHandoverPin(orderId);
  return expected === enteredPin.trim();
}
