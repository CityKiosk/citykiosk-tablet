// ============================================================================
// Public Mobile Catalog Page — list view of the shared catalog
// ============================================================================
// Same data source as /v/[token] (RPC get_public_catalog), different renderer.
// Customers arrive here either by direct link or by UA-based redirect from
// /v/[token] when the device is a phone.
// ============================================================================

import { notFound } from "next/navigation";
import { DISPLAY_FIELD_DEFAULTS } from "@/lib/displayFields";
import PublicCatalogList from "./PublicCatalogList";
import { getPublicCatalog } from "../_data/catalog";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicMobileCatalogPage({ params }: PageProps) {
  const { token } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) notFound();

  const data = await getPublicCatalog(token);
  if (!data || data.products.length === 0) notFound();

  return (
    <PublicCatalogList
      token={token}
      products={data.products}
      categories={data.categories}
      displayFields={data.display_fields ?? DISPLAY_FIELD_DEFAULTS}
    />
  );
}
