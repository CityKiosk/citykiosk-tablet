// ============================================================================
// Public-catalog data layer
// ============================================================================
// Single source of truth for everything the public catalog routes need from
// Supabase. Responsibilities, intentionally limited:
//
//   1. Fetch the RPC payload (server-only)
//   2. Cache it across routes with unstable_cache so /m → /p navigation
//      reuses the same data without a second RPC roundtrip
//   3. Expose strongly-typed shapes derived from the generated Supabase types
//
// View components import the *types* but never the *fetcher*. Pages import
// the fetcher and pass plain data down. This keeps the routes thin and the
// view components framework-agnostic.
// ============================================================================

import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type RpcReturn = Database["public"]["Functions"]["get_public_catalog"]["Returns"];

export type PublicCatalogPayload = {
  products: NonNullable<RpcReturn["products"]>;
  categories: NonNullable<RpcReturn["categories"]>;
  display_fields: RpcReturn["display_fields"];
};

export type PublicProduct = PublicCatalogPayload["products"][number];
export type PublicCategory = PublicCatalogPayload["categories"][number];
export type PublicDisplayFields = PublicCatalogPayload["display_fields"];

// Tag the cache by token so a future "owner toggled a field" action could
// call revalidateTag(`public-catalog:${token}`) to invalidate without
// waiting for the 60s timer.
export async function getPublicCatalog(token: string): Promise<PublicCatalogPayload | null> {
  const fetcher = unstable_cache(
    async (t: string): Promise<PublicCatalogPayload | null> => {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("get_public_catalog", {
        share_token: t,
      });
      if (error || !data) return null;
      return {
        products: data.products ?? [],
        categories: data.categories ?? [],
        display_fields: data.display_fields,
      };
    },
    ["public-catalog"],
    {
      revalidate: 60,
      tags: [`public-catalog:${token}`],
    },
  );
  return fetcher(token);
}
