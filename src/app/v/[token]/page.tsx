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

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PublicFlipbook from "./PublicFlipbook";
import { DISPLAY_FIELD_DEFAULTS } from "@/lib/displayFields";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicCatalogPage({ params }: PageProps) {
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
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <PublicFlipbook
        token={token}
        products={products}
        categories={categories}
        displayFields={displayFields}
      />
    </div>
  );
}
