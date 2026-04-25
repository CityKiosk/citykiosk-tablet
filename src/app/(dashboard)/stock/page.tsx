// ============================================================================
// Stock Page — Server Component
// ============================================================================
// Auth-checked server fetch → StockClient (password-gated, admin-only).
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchStockProducts } from "./actions";
import { StockClient } from "./StockClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stok · Souvenirs Berlin",
  robots: { index: false, follow: false },
};

export default async function StockPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { products, categories } = await fetchStockProducts();

  return (
    <StockClient
      products={products ?? []}
      categories={categories ?? []}
    />
  );
}
