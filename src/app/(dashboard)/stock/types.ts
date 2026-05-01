// Stock at or below this count is flagged as low. Effectively means "below
// 100" — items with stock < 100 (including negative) trigger the red color
// in StockRow and increment the sidebar badge in the layout.
export const LOW_STOCK_THRESHOLD = 99;

export type StockProduct = {
  id: string;
  name_de: string;
  image_url: string | null;
  category_id: string | null;
  stock: number;
  sku: string | null;
  price: number;
  description_de: string | null;
  dimensions: string | null;
  packaging_unit: number | null;
};

export type StockCategory = {
  id: string;
  name_de: string;
};
