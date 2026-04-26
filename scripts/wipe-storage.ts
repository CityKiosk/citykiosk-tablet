// Run: npx tsx scripts/wipe-storage.ts
// Deletes ALL files in the product-images bucket. Bucket itself stays.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);
const BUCKET = "product-images";

async function collectPaths(prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(`list "${prefix}": ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        paths.push(...(await collectPaths(full)));
      } else {
        paths.push(full);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return paths;
}

async function main() {
  console.log(`Listing files in bucket "${BUCKET}"...`);
  const paths = await collectPaths();
  console.log(`Found ${paths.length} file(s).`);
  if (paths.length === 0) return;

  const batchSize = 1000;
  let deleted = 0;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) {
      console.error(`remove batch ${i / batchSize}:`, error.message);
      continue;
    }
    deleted += batch.length;
    console.log(`Deleted ${deleted}/${paths.length}`);
  }

  const { data: remaining } = await supabase.storage.from(BUCKET).list("", { limit: 1 });
  console.log(`Done. Remaining top-level entries: ${remaining?.length ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
