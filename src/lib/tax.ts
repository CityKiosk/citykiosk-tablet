/**
 * German VAT (Mehrwertsteuer) constants and helpers.
 *
 * Wholesale (B2B) pricing model: stored product prices are net. Tax is
 * computed at order time and stamped onto the row, so historical orders
 * stay correct if the rate ever changes.
 */

/** Standard German VAT rate (Regelsteuersatz). Souvenirs fall under this
 *  rate; reduced 7% applies to food/books/etc. but isn't used here. */
export const DEFAULT_TAX_RATE = 19;

/** Returns { tax, gross } rounded to 2 decimals. Both inputs are net €. */
export function calculateTax(net: number, ratePercent: number = DEFAULT_TAX_RATE): {
  tax: number;
  gross: number;
} {
  const tax = Math.round(net * ratePercent) / 100;
  const gross = Math.round((net + tax) * 100) / 100;
  return { tax, gross };
}

/** Allowed range for the owner's order-level discount (percent). Server
 *  enforces the same range; keep the UI clamp in sync with the DB CHECK
 *  constraint in 20260515_order_discount.sql. */
export const MAX_DISCOUNT_PCT = 20;

/** Apply an order-level percentage discount to a pre-discount net subtotal
 *  and recompute VAT + gross. Returns rounded values matching what is
 *  stored on the order row. */
export function applyDiscount(
  subtotal: number,
  discountPct: number,
  ratePercent: number = DEFAULT_TAX_RATE,
): {
  discountAmount: number;
  net: number;
  tax: number;
  gross: number;
} {
  const clampedPct = Math.max(0, Math.min(MAX_DISCOUNT_PCT, Math.trunc(discountPct)));
  const discountAmount = Math.round(subtotal * clampedPct) / 100;
  const net = Math.round((subtotal - discountAmount) * 100) / 100;
  const { tax, gross } = calculateTax(net, ratePercent);
  return { discountAmount, net, tax, gross };
}
