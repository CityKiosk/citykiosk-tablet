// ============================================================================
// Public Product Detail Page — full-screen single product (no auth)
// ============================================================================
// Reached from the mobile catalog list (PublicCatalogList card link).
// Shareable URL: customers can paste a specific product link into WhatsApp.
// Reuses the same RPC payload that fuels the list/flipbook so we don't add a
// new SECURITY DEFINER function for a single lookup.
// ============================================================================

import { notFound } from "next/navigation";
import { DISPLAY_FIELD_DEFAULTS } from "@/lib/displayFields";
import PublicProductDetail from "./PublicProductDetail";
import { getPublicCatalog } from "../../_data/catalog";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ token: string; productId: string }>;
};

export default async function PublicProductPage({ params }: PageProps) {
  const { token, productId } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token) || !uuidRegex.test(productId)) notFound();

  const data = await getPublicCatalog(token);
  if (!data) notFound();

  const product = data.products.find((p) => p.id === productId);
  if (!product) notFound();

  const category = product.category_id
    ? data.categories.find((c) => c.id === product.category_id) ?? null
    : null;

  return (
    <PublicProductDetail
      token={token}
      product={product}
      category={category}
      displayFields={data.display_fields ?? DISPLAY_FIELD_DEFAULTS}
    />
  );
}
