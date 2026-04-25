// ============================================================================
// Browse Page — Horizontal Scrolling Catalog (Server Component)
// ============================================================================
// Same data as /catalog but rendered in a horizontal-scroll layout.
// Existing /catalog page remains unchanged.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BrowseCatalogClient } from "./BrowseCatalogClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vitrin · Souvenirs Berlin",
  robots: { index: false, follow: false },
};

export default async function BrowsePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, name_de, sort_order")
    .eq("is_active", true)
    .eq("owner_id", user.id)
    .order("name_de", { ascending: true });

  const { data: products } = await supabase
    .from("products")
    .select("id, name_de, price, image_url, category_id, dimensions, packaging_unit, sku, description_de, sort_order")
    .eq("is_active", true)
    .eq("owner_id", user.id)
    .order("sort_order", { ascending: true });

  return (
    <BrowseCatalogClient
      categories={categories ?? []}
      products={products ?? []}
    />
  );
}
