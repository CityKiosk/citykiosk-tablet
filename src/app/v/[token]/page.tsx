// ============================================================================
// Public Catalog Page — No auth, no dashboard, isolated
// ============================================================================
// Accessible via share link: /v/[token]
// Fetches catalog data via Supabase RPC (get_public_catalog).
//
// Phone vs flipbook routing happens in middleware.ts so the redirect bypasses
// page-level cache (with revalidate=60 + a static-eligible payload the cache
// can otherwise serve a desktop render to a phone). This route only renders
// the flipbook view; phones get redirected to /v/[token]/m before they get
// here.
// ============================================================================

import { notFound } from "next/navigation";
import PublicFlipbook from "./PublicFlipbook";
import { DISPLAY_FIELD_DEFAULTS } from "@/lib/displayFields";
import { getPublicCatalog } from "./_data/catalog";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicCatalogPage({ params }: PageProps) {
  const { token } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) notFound();

  const data = await getPublicCatalog(token);
  if (!data || data.products.length === 0) notFound();

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <PublicFlipbook
        token={token}
        products={data.products}
        categories={data.categories}
        displayFields={data.display_fields ?? DISPLAY_FIELD_DEFAULTS}
      />
    </div>
  );
}
