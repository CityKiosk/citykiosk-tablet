export type Locale = "tr" | "de";

export type Category = {
  id: string;
  nameTr: string;
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
  productNameTr?: string;
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
  total: number;
  createdAt: string;
};
