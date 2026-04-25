export const LOW_STOCK_THRESHOLD = 5;

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
