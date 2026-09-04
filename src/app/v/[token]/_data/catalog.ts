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
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { publicCatalogRateLimit } from "@/lib/rateLimit";

// Stateless anon client — no cookies, no session. The public catalog RPC is
// SECURITY DEFINER and granted to `anon`, so user context is irrelevant.
// A cookies-bound client would crash inside unstable_cache because Next.js
// forbids dynamic data sources (cookies/headers) in a cache scope.
const publicClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

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
      // This body only runs on a cache MISS. Global cap on misses bounds the
      // RPC amplification of distinct-token fuzzing. THROW (don't return null)
      // so unstable_cache does not memoise a rate-limited empty for this token
      // — the outer catch turns it into a normal not-found.
      if (!publicCatalogRateLimit.check("global")) {
        throw new Error("public_catalog_rate_limited");
      }
      const { data, error } = await publicClient.rpc("get_public_catalog", {
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
  try {
    return await fetcher(token);
  } catch {
    // Rate-limited miss (or transient error) → behave like an unknown token.
    return null;
  }
}
