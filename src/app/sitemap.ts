import type { MetadataRoute } from "next";

// Private app — no pages should be indexed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
