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
