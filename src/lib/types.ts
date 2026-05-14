/** Single-locale app — DE only. The Locale alias stays so existing call
 *  sites (formatPrice, formatDate, useI18n().locale) keep type-checking
 *  without a global churn; new code can ignore it. */
export type Locale = "de";

export type Category = {
  id: string;
  nameDe: string;
};

export type Product = {
  id: string;
  image: string;
  categoryId: string;
  price: number;
  dim?: string;
  ve?: number;
  sku?: string;
  description?: string;
  /** Optional override name for custom user-added products (no i18n) */
  customName?: string;
  customDescription?: string;
};

export type Customer = {
  id: string;
  name: string;
  shopName: string;
};

export type OrderItem = {
  productId: string;
  productName: string;
  productNameDe?: string | null;
  productImage: string;
  productSku?: string;
  productDescription?: string;
  quantity: number;
  price: number;
};

export type Order = {
  id: string;
  customerId: string;
  customerName: string;
  shopName: string;
  items: OrderItem[];
  /** Net total AFTER discount (sum of line totals minus discountAmount). */
  total: number;
  /** Applied VAT rate as a percent (e.g. 19). 0 means legacy/no breakdown. */
  taxRate: number;
  /** VAT amount in euro. */
  taxAmount: number;
  /** Gross total = total + taxAmount. What the customer pays. */
  grossTotal: number;
  /** Order-level discount percentage applied (0..20). 0 = no discount. */
  discountPct: number;
  /** Discount amount in euro (subtotal × discountPct/100). 0 if no discount. */
  discountAmount: number;
  createdAt: string;
};
