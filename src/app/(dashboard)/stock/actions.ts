"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePinUnlocked } from "@/lib/pinSession";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOW_STOCK_THRESHOLD, type StockCategory, type StockProduct } from "./types";

export async function fetchStockProducts(): Promise<{
  products?: StockProduct[];
  categories?: StockCategory[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const [prodRes, catRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name_tr, name_de, image_url, category_id, stock, sku, price, description_tr, description_de, dimensions, packaging_unit")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name_tr, name_de")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .order("name_de", { ascending: true }),
  ]);

  if (prodRes.error || catRes.error) {
    return { error: "Daten konnten nicht geladen werden" };
  }
  return { products: prodRes.data ?? [], categories: catRes.data ?? [] };
}

// Trigger floor is -9999; cap to a practical upper bound to block typo overflow.
const UpdateStockSchema = z.object({
  productId: z.string().uuid(),
  stock: z.number().int().gte(-9999).lte(999999),
});

export async function updateStock(
  productId: string,
  stock: number,
): Promise<{ success?: boolean; stock?: number; error?: string }> {
  const parsed = UpdateStockSchema.safeParse({ productId, stock });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Ungültiger Wert" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked();
  if (gate) return { error: "PIN erforderlich" };

  const { data, error } = await supabase
    .from("products")
    .update({ stock: parsed.data.stock })
    .eq("id", parsed.data.productId)
    .eq("owner_id", user.id)
    .select("stock")
    .single();

  if (error || !data) return { error: "Speichern fehlgeschlagen" };

  revalidatePath("/stock");
  revalidatePath("/catalog");
  revalidatePath("/", "layout");
  return { success: true, stock: data.stock };
}

export async function fetchLowStockCount(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .lte("stock", LOW_STOCK_THRESHOLD);

  return count ?? 0;
}
