// ============================================================================
// Browse Page — Horizontal Scrolling Catalog (Server Component)
// ============================================================================
// Same data as /catalog but rendered in a horizontal-scroll layout.
// Existing /catalog page remains unchanged.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BrowseCatalogClient } from "./BrowseCatalogClient";
import { fetchDisplayFields } from "@/app/(dashboard)/settings/actions";
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

  const [{ data: categories }, { data: rawProducts }, displayFields] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, slug, name_de, sort_order")
        .eq("is_active", true)
        .eq("owner_id", user.id)
        .order("name_de", { ascending: true }),
      supabase
        .from("products")
        .select("id, name_de, price, image_url, category_id, dimensions, packaging_unit, sku, description_de, sort_order")
        .eq("is_active", true)
        .eq("owner_id", user.id)
        .order("sort_order", { ascending: true }),
      fetchDisplayFields(),
    ]);

  // /browse ist kundenseitig (Vitrin). Ausgeblendete Felder werden serverseitig
  // GENULLT, nicht nur im Render versteckt — sonst stecken sie in der RSC-Payload
  // und sind über View-Source lesbar. Gleiches Muster wie get_public_catalog für
  // /v/[token] (threat-model.md K3). `name` bleibt immer (Produktname).
  const f = displayFields.browse;
  const products = (rawProducts ?? []).map((p) => ({
    ...p,
    price: f.price ? p.price : null,
    sku: f.sku ? p.sku : null,
    dimensions: f.dimensions ? p.dimensions : null,
    packaging_unit: f.packagingUnit ? p.packaging_unit : null,
    description_de: f.description ? p.description_de : null,
  }));

  return (
    <BrowseCatalogClient
      categories={categories ?? []}
      products={products}
    />
  );
}
