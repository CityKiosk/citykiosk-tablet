// ============================================================================
// Public Catalog Page — No auth, no dashboard, isolated
// ============================================================================
// Accessible via share link: /v/[token]
// Fetches catalog data via Supabase RPC (get_public_catalog).
//
// Renderer selection (server-side, before render → no flash):
//   1. ?view=flipbook  → always flipbook
//   2. ?view=list      → redirect to /v/[token]/m
//   3. mobile UA       → redirect to /v/[token]/m
//   4. otherwise       → flipbook (default for tablet/desktop)
//
// localStorage preference handled client-side inside PublicFlipbook /
// PublicCatalogList (one extra hop on edge-case devices where UA disagrees
// with the customer's previous choice).
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import PublicFlipbook from "./PublicFlipbook";
import { DISPLAY_FIELD_DEFAULTS } from "@/lib/displayFields";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ view?: string }>;
};

// Phone-targeting UA regex. Picks up Android+Mobile, iPhone, BlackBerry, IEMobile
// and miscellaneous Mobi UAs. iPads and Android tablets (no "Mobile" token)
// stay on the flipbook view.
const PHONE_UA = /iPhone|Android.+Mobile|Windows Phone|IEMobile|BlackBerry|Mobi/i;

export default async function PublicCatalogPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { view } = await searchParams;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) notFound();

  if (view === "list") redirect(`/v/${token}/m`);

  if (view !== "flipbook") {
    const ua = (await headers()).get("user-agent") ?? "";
    if (PHONE_UA.test(ua)) redirect(`/v/${token}/m`);
  }

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
