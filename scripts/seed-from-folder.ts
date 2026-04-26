// Seed categories + products from a local folder.
//
// Folder convention:
//   <root>/
//     <Category Name>/
//       <Product Name>.jpg   (jpg|jpeg|png|webp|heic)
//
// Each top-level subfolder → category (name_de = folder name).
// Each image inside → product (name_de = filename without extension, price = 0).
//
// Image optimization: sharp → max 1600px, JPEG quality 85 (mozjpeg).
//
// Usage:
//   DRY_RUN=1 npx tsx scripts/seed-from-folder.ts <root>
//   SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' npx tsx scripts/seed-from-folder.ts <root>
//
// Defaults: root = ~/Desktop/souvenir_photos

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const ROOT = process.argv[2] || path.join(os.homedir(), "Desktop", "souvenir_photos");
const DRY_RUN = process.env.DRY_RUN === "1";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY_RUN && (!url || !serviceKey)) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set DRY_RUN=1 to scan only)");
  process.exit(1);
}

const supabase = !DRY_RUN ? createClient(url!, serviceKey!) : null;

const IMAGE_RE = /\.(jpe?g|png|webp|heic)$/i;

// German-aware slugify
function slugify(input: string): string {
  return input
    .normalize("NFC")
    .replace(/ä/gi, "ae")
    .replace(/ö/gi, "oe")
    .replace(/ü/gi, "ue")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stem(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim();
}

// Normalize category folder name → display name
// Strips " PNG" suffix and applies casing fixes for known irregulars.
const CATEGORY_OVERRIDES: Record<string, string> = {
  FOTOMAGNET: "Fotomagnet",
  POLYMAGNETE: "Polymagnete",
  MetallMagnete: "Metall Magnete",
};

function normalizeCategory(folderName: string): string {
  const stripped = folderName.replace(/\s*PNG\s*$/i, "").trim().normalize("NFC");
  return CATEGORY_OVERRIDES[stripped] ?? stripped;
}

type Plan = {
  folder: string;     // original folder name on disk
  category: string;   // display name (name_de)
  slug: string;
  files: string[];
};

async function buildPlan(): Promise<Plan[]> {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const plans: Plan[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue; // skip hidden (.DS_Store etc)
    const folder = path.join(ROOT, entry.name);
    const files = (await readdir(folder)).filter((f) => IMAGE_RE.test(f) && !f.startsWith(".")).sort();
    const displayName = normalizeCategory(entry.name);
    plans.push({
      folder: entry.name,
      category: displayName,
      slug: slugify(displayName),
      files,
    });
  }
  return plans;
}

async function main() {
  console.log(`Root: ${ROOT}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "COMMIT"}\n`);

  const plans = await buildPlan();
  if (plans.length === 0) {
    console.error("No category folders found.");
    process.exit(1);
  }

  // Print plan summary
  let total = 0;
  for (const p of plans) {
    console.log(`📁 ${p.category} (slug: ${p.slug}) — ${p.files.length} image(s)`);
    total += p.files.length;
  }
  console.log(`\nTotal: ${plans.length} categories, ${total} products\n`);

  if (DRY_RUN) {
    console.log("Dry run complete. Re-run without DRY_RUN=1 to commit.");
    return;
  }

  // Find single owner
  const { data: usersResp, error: usersErr } = await supabase!.auth.admin.listUsers();
  if (usersErr) throw new Error(`listUsers: ${usersErr.message}`);
  const ownerId = usersResp?.users?.[0]?.id;
  if (!ownerId) throw new Error("No auth user found");
  console.log(`Owner: ${ownerId}\n`);

  // Insert categories + products
  let catSort = 0;
  for (const p of plans) {
    catSort++;
    const { data: cat, error: catErr } = await supabase!
      .from("categories")
      .insert({
        owner_id: ownerId,
        name_de: p.category,
        slug: p.slug,
        sort_order: catSort,
        is_active: true,
      })
      .select("id")
      .single();

    if (catErr) {
      console.error(`✗ category "${p.category}": ${catErr.message}`);
      continue;
    }
    console.log(`📁 ${p.category} → ${cat.id}`);

    let n = 0;
    for (const file of p.files) {
      n++;
      const productName = stem(file);
      const filePath = path.join(ROOT, p.folder, file);

      let optimized: Buffer;
      try {
        const buf = await readFile(filePath);
        optimized = await sharp(buf)
          .rotate()
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
      } catch (err) {
        console.error(`  ✗ optimize "${file}":`, (err as Error).message);
        continue;
      }

      const storagePath = `${ownerId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase!.storage
        .from("product-images")
        .upload(storagePath, optimized, { contentType: "image/jpeg", upsert: false });
      if (upErr) {
        console.error(`  ✗ upload "${file}":`, upErr.message);
        continue;
      }

      const { data: pub } = supabase!.storage.from("product-images").getPublicUrl(storagePath);

      const { error: prodErr } = await supabase!.from("products").insert({
        owner_id: ownerId,
        category_id: cat.id,
        name_de: productName,
        price: 0,
        image_url: pub.publicUrl,
        sort_order: n,
        is_active: true,
      });
      if (prodErr) {
        console.error(`  ✗ insert "${productName}":`, prodErr.message);
        continue;
      }

      if (n % 10 === 0 || n === p.files.length) {
        console.log(`   ${n}/${p.files.length}`);
      }
    }
  }

  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
