// Re-crop and re-upload images for ONE category.
// Default: center-crop to square (matches catalog card's aspect-square frame).
// Replaces storage object in-place — DB image_url stays the same.
//
// Reversible: source files on disk are untouched. Run with SQUARE=0 to restore
// the un-cropped original (same pipeline as initial seed).
//
// Usage:
//   DRY_RUN=1 SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' \
//     npx tsx scripts/retrim-category.ts <category-name> <source-root>
//
//   SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' \
//     npx tsx scripts/retrim-category.ts "Mauerlook" "$HOME/Desktop/souvenir-new-photos/KATALOG PNG"
//
// Restore (no crop, original aspect):
//   SQUARE=0 SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' \
//     npx tsx scripts/retrim-category.ts "Mauerlook" "$HOME/Desktop/souvenir-new-photos/KATALOG PNG"

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const CATEGORY = process.argv[2];
const ROOT = process.argv[3];
const DRY_RUN = process.env.DRY_RUN === "1";
const SQUARE = process.env.SQUARE !== "0"; // default: center-crop to square ON

if (!CATEGORY || !ROOT) {
  console.error("Usage: npx tsx scripts/retrim-category.ts <category-name> <source-root>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);
const BUCKET = "product-images";
const IMAGE_RE = /\.(jpe?g|png|webp|heic)$/i;

function stem(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim();
}

// Find the source folder matching the category (with possible " PNG" suffix).
// Normalizes both sides to NFC — macOS stores filenames as NFD.
async function findSourceFolder(): Promise<string> {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const cat = CATEGORY.normalize("NFC");
  const candidates = [cat, `${cat} PNG`, `${cat.toUpperCase()} PNG`];
  for (const c of candidates) {
    const found = entries.find((e) => e.isDirectory() && e.name.normalize("NFC") === c);
    if (found) return path.join(ROOT, found.name);
  }
  const fuzzy = entries.find(
    (e) => e.isDirectory() && e.name.normalize("NFC").replace(/\s*PNG\s*$/i, "").trim() === cat
  );
  if (fuzzy) return path.join(ROOT, fuzzy.name);
  throw new Error(`No source folder found for category "${CATEGORY}" in ${ROOT}`);
}

// Extract the bucket-relative path from a Supabase public URL.
// e.g. https://x.supabase.co/storage/v1/object/public/product-images/<owner>/<uuid>.jpg
//   →  <owner>/<uuid>.jpg
function pathFromPublicUrl(publicUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = publicUrl.indexOf(marker);
  if (i < 0) return null;
  return publicUrl.slice(i + marker.length);
}

async function main() {
  console.log(`Category: ${CATEGORY}`);
  console.log(`Source:   ${ROOT}`);
  console.log(`Mode:     ${DRY_RUN ? "DRY RUN (no writes)" : "COMMIT"}`);
  console.log(`Crop:     ${SQUARE ? "ON (center-crop to square)" : "OFF (restore original aspect)"}\n`);

  const sourceFolder = await findSourceFolder();
  console.log(`Source folder resolved: ${sourceFolder}`);

  // Find the category in DB
  const { data: cat, error: catErr } = await supabase
    .from("categories")
    .select("id, name_de")
    .eq("name_de", CATEGORY)
    .single();
  if (catErr || !cat) throw new Error(`Category "${CATEGORY}" not found in DB`);
  console.log(`DB category: ${cat.name_de} (${cat.id})`);

  // Fetch products in that category
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name_de, image_url")
    .eq("category_id", cat.id);
  if (prodErr) throw new Error(prodErr.message);
  console.log(`Products in DB: ${products?.length ?? 0}`);

  // Build name_de → image_url map
  const byName = new Map<string, { id: string; image_url: string | null }>();
  for (const p of products ?? []) byName.set(p.name_de, { id: p.id, image_url: p.image_url });

  // Walk source files
  const files = (await readdir(sourceFolder)).filter((f) => IMAGE_RE.test(f) && !f.startsWith("."));
  console.log(`Source files:   ${files.length}\n`);

  let processed = 0;
  let missing = 0;
  for (const file of files) {
    const name = stem(file);
    const product = byName.get(name);
    if (!product || !product.image_url) {
      console.warn(`  ⚠ no DB match for "${name}"`);
      missing++;
      continue;
    }
    const storagePath = pathFromPublicUrl(product.image_url);
    if (!storagePath) {
      console.warn(`  ⚠ unparseable image_url for "${name}"`);
      missing++;
      continue;
    }

    const buf = await readFile(path.join(sourceFolder, file));

    // Flatten transparent PNG to white (JPEG has no alpha channel).
    let pipeline = sharp(buf).rotate().flatten({ background: "#ffffff" });
    if (SQUARE) {
      // Center-crop to a square using the shorter side. Then resize.
      const meta = await sharp(buf).rotate().metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      const side = Math.min(w, h);
      pipeline = pipeline.extract({
        left: Math.floor((w - side) / 2),
        top: Math.floor((h - side) / 2),
        width: side,
        height: side,
      });
    }
    const optimized = await pipeline
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    if (DRY_RUN) {
      console.log(`  [dry] "${name}" → ${storagePath} (${(optimized.length / 1024).toFixed(0)} KB)`);
      processed++;
      continue;
    }

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, optimized, { contentType: "image/jpeg", upsert: true });
    if (upErr) {
      console.error(`  ✗ "${name}":`, upErr.message);
      continue;
    }
    processed++;
    if (processed % 10 === 0 || processed === files.length) {
      console.log(`  ${processed}/${files.length}`);
    }
  }

  console.log(`\nDone. Processed: ${processed}, Missing matches: ${missing}`);
  if (!DRY_RUN) {
    console.log("Note: public URLs unchanged. Browser/CDN may cache old image briefly.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
