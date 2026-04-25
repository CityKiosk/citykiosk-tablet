// ============================================================================
// Public Catalog Page — No auth, no dashboard, isolated
// ============================================================================
// Accessible via share link: /v/[token]
// Fetches catalog data via Supabase RPC (get_public_catalog)
// Renders flipbook for anyone with a valid token.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PublicFlipbook from "./PublicFlipbook";
import { DISPLAY_FIELD_DEFAULTS } from "@/lib/displayFields";

// Cap CDN/browser cache so owner toggle changes become visible without manual
// purge. 60s is short enough that customers see updates quickly on refresh,
// long enough to absorb bursts of RPC calls.
export const revalidate = 60;

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicCatalogPage({ params }: PageProps) {
  const { token } = await params;

  // Validate UUID format
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
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <PublicFlipbook products={products} categories={categories} displayFields={displayFields} />
    </div>
  );
}
