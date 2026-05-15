// ============================================================================
// Public Mobile Catalog Page — list view of the shared catalog
// ============================================================================
// Same data source as /v/[token] (RPC get_public_catalog), different renderer.
// Customers arrive here either by direct link or by UA-based redirect from
// /v/[token] when the device is a phone.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { DISPLAY_FIELD_DEFAULTS } from "@/lib/displayFields";
import PublicCatalogList from "./PublicCatalogList";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicMobileCatalogPage({ params }: PageProps) {
  const { token } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_catalog", {
    share_token: token,
  });

  if (error || !data) notFound();

  const products = data.products ?? [];
  const categories = data.categories ?? [];
  const displayFields = data.display_fields ?? DISPLAY_FIELD_DEFAULTS;

  if (products.length === 0) notFound();

  return (
    <PublicCatalogList
      token={token}
      products={products}
      categories={categories}
      displayFields={displayFields}
    />
  );
}
