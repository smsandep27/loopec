export type CommissionBreakdown = {
  subtotal: number;
  commissionPercent: number;
  commissionAmount: number;
  sellerNetAmount: number;
  totalAmount: number;
  formatted: {
    subtotal: string;
    commissionAmount: string;
    sellerNetAmount: string;
    totalAmount: string;
  };
};

export const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const inrFormatterWithDecimals = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Calculates the platform commission (default 5%) and seller net payout.
 *
 * Example:
 * subtotal = 1000
 * percent = 5
 * commissionAmount = 50 (CiGaRa / LOOPEC platform fee)
 * sellerNetAmount = 950 (Net seller payout)
 */
export function calculateCommission(
  subtotal: number | string,
  percent = 5
): CommissionBreakdown {
  const numSubtotal = Math.max(0, Number(subtotal) || 0);
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 5));

  const commissionAmount = Math.round((numSubtotal * safePercent) / 100 * 100) / 100;
  const sellerNetAmount = Math.max(0, Math.round((numSubtotal - commissionAmount) * 100) / 100);

  return {
    subtotal: numSubtotal,
    commissionPercent: safePercent,
    commissionAmount,
    sellerNetAmount,
    totalAmount: numSubtotal,
    formatted: {
      subtotal: inrFormatter.format(numSubtotal),
      commissionAmount: inrFormatter.format(commissionAmount),
      sellerNetAmount: inrFormatter.format(sellerNetAmount),
      totalAmount: inrFormatter.format(numSubtotal),
    },
  };
}
