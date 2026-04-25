// ============================================================================
// Catalog Page — Server Component
// ============================================================================
// Fetches categories + products from Supabase, passes to CatalogClient
// for interactive filtering/sorting/search.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CatalogClient } from "./CatalogClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Katalog · Souvenirs Berlin",
  robots: { index: false, follow: false },
};

export default async function CatalogPage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  // Fetch categories (explicit owner_id for defense-in-depth alongside RLS)
  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, name_tr, name_de, sort_order")
    .eq("is_active", true)
    .eq("owner_id", user.id)
    .order("name_de", { ascending: true });

  // Fetch products (explicit owner_id for defense-in-depth alongside RLS)
  const { data: products } = await supabase
    .from("products")
    .select("id, name_tr, name_de, price, image_url, category_id, dimensions, packaging_unit, sku, description_tr, description_de, sort_order")
    .eq("is_active", true)
    .eq("owner_id", user.id)
    .order("sort_order", { ascending: true });

  return (
    <CatalogClient
      categories={categories ?? []}
      products={products ?? []}
    />
  );
}
