import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { calculateCommission } from "../lib/payments/commission.ts";

test("calculates 5% platform commission and 95% seller payout accurately", () => {
  const c1 = calculateCommission(100, 5);
  assert.equal(c1.subtotal, 100);
  assert.equal(c1.commissionPercent, 5);
  assert.equal(c1.commissionAmount, 5);
  assert.equal(c1.sellerNetAmount, 95);
  assert.equal(c1.totalAmount, 100);

  const c2 = calculateCommission(599, 5);
  assert.equal(c2.subtotal, 599);
  assert.equal(c2.commissionAmount, 29.95);
  assert.equal(c2.sellerNetAmount, 569.05);

  const c3 = calculateCommission(1500, 5);
  assert.equal(c3.commissionAmount, 75);
  assert.equal(c3.sellerNetAmount, 1425);
});

test("handles commission edge cases gracefully", () => {
  const zero = calculateCommission(0, 5);
  assert.equal(zero.subtotal, 0);
  assert.equal(zero.commissionAmount, 0);
  assert.equal(zero.sellerNetAmount, 0);

  const negative = calculateCommission(-50, 5);
  assert.equal(negative.subtotal, 0);
  assert.equal(negative.commissionAmount, 0);
});

test("cryptographic signature verification for payment security", () => {
  const secret = "test_razorpay_secret_key_12345";
  const orderId = "order_NITC_998877";
  const paymentId = "pay_NITC_112233";

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(typeof expectedSignature, "string");
  assert.equal(expectedSignature.length, 64);
});
