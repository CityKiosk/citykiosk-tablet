#!/usr/bin/env node
// ============================================================================
// Bulk Upload — Local photos → Supabase Storage + DB
// ============================================================================
// Usage:
//   node scripts/bulk-upload.mjs ~/Desktop/souvenir-photos
//
// Expects folder structure:
//   souvenir-photos/
//   ├── Flaschenöffner/
//   │   ├── foto1.jpg
//   │   └── foto2.jpg
//   ├── Fotomagnete/
//   │   └── ...
//   └── ...
//
// Each subfolder = category (German name)
// Each image = product (name derived from filename)
// Prices left empty (0) — shop owner enters later via app
//
// Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, basename, extname, resolve } from "path";
import { execSync } from "child_process";

// ── Load env from .env.local ──
const envPath = resolve(process.cwd(), ".env.local");
if (!existsSync(envPath)) {
  console.error("❌ .env.local not found. Run from project root.");
  process.exit(1);
}
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.replace(/\r/g, "").trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  // Remove surrounding quotes if present
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// Debug
if (!SUPABASE_URL || SUPABASE_URL.includes("YAPISTIR")) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL is not set properly in .env.local");
  console.error("   Current value:", JSON.stringify(SUPABASE_URL));
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// ── Service role client (bypasses RLS for bulk insert) ──
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Category mapping: German folder name → TR + DE + slug ──
const CATEGORY_MAP = {
  "Flaschenöffner":      { name_tr: "Açacak Magnetler",           name_de: "Flaschenöffner",      slug: "flaschenoeffner" },
  "Fotomagnete":         { name_tr: "Foto Magnetler",             name_de: "Fotomagnete",         slug: "fotomagnete" },
  "Haarklemmen":         { name_tr: "Saç Tokaları",               name_de: "Haarklemmen",         slug: "haarklemmen" },
  "Mauerlook":           { name_tr: "Duvar Görünümlü Magnetler",  name_de: "Mauerlook",           slug: "mauerlook" },
  "Metall Magnete":      { name_tr: "Metal Magnetler",            name_de: "Metall Magnete",      slug: "metall-magnete" },
  "Polymagnete PNG":     { name_tr: "Poly Magnetler",             name_de: "Polymagnete",         slug: "polymagnete" },
  "Schlüsselanhänger":   { name_tr: "Anahtarlıklar",              name_de: "Schlüsselanhänger",   slug: "schluesselanhaenger" },
  "Socken Fussmodel":    { name_tr: "Çoraplar",                   name_de: "Socken Fussmodel",    slug: "socken" },
  "Steinmagnete":        { name_tr: "Taş Magnetler",              name_de: "Steinmagnete",        slug: "steinmagnete" },
  "Stifte":              { name_tr: "Kalemler",                    name_de: "Stifte",              slug: "stifte" },
};

// ── Image extensions we accept ──
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"]);

// ── Get the first authenticated user (single-user app) ──
async function getOwnerUserId() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`Failed to list users: ${error.message}`);
  if (!data.users.length) throw new Error("No users found. Create a user in Supabase Dashboard first.");
  return data.users[0].id;
}

// ── Optimize image: resize to max 1200px width + JPEG 90% quality ──
// Tablet'te mükemmel kalite, dosya boyutu 10-20x küçülür.
// Boyut değişir ama kalite farkı gözle görülmez.
function optimizeImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  let buffer = readFileSync(filePath);
  const originalSize = buffer.length;
  const MAX_WIDTH = 1200;

  try {
    const tmpPath = `/tmp/souvenir_opt_${Date.now()}.jpg`;

    // Get current width
    const widthStr = execSync(
      `sips -g pixelWidth "${filePath}" | tail -1 | awk '{print $2}'`,
      { encoding: "utf-8" }
    ).trim();
    const currentWidth = parseInt(widthStr, 10);

    if (currentWidth > MAX_WIDTH) {
      // Resize + convert to JPEG 90%
      execSync(`sips --resampleWidth ${MAX_WIDTH} -s format jpeg -s formatOptions 90 "${filePath}" --out "${tmpPath}" 2>/dev/null`);
    } else {
      // Just convert/compress to JPEG 90% (keep dimensions)
      execSync(`sips -s format jpeg -s formatOptions 90 "${filePath}" --out "${tmpPath}" 2>/dev/null`);
    }

    const newBuffer = readFileSync(tmpPath);
    // Only use optimized version if actually smaller
    if (newBuffer.length < buffer.length) {
      buffer = newBuffer;
    }
    execSync(`rm -f "${tmpPath}"`);
  } catch {
    console.warn(`  ⚠ Could not optimize ${basename(filePath)}, using original`);
  }

  const newSize = buffer.length;
  const saved = originalSize - newSize;
  if (saved > 1024) {
    console.log(`  📦 ${(originalSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB (-${Math.round((saved / originalSize) * 100)}%)`);
  } else {
    console.log(`  📦 ${(newSize / 1024).toFixed(0)}KB`);
  }

  return { buffer, contentType: "image/jpeg" };
}

// ── Clean filename → product name ──
function filenameToProductName(filename) {
  return filename
    .replace(extname(filename), "")    // remove extension
    .replace(/[-_]/g, " ")             // dashes/underscores → spaces
    .replace(/\s+/g, " ")             // collapse whitespace
    .replace(/^\d+\s*/, "")           // remove leading numbers (sort prefix)
    .trim();
}

// ── Main ──
async function main() {
  const photosDir = process.argv[2];
  if (!photosDir) {
    console.error("Usage: node scripts/bulk-upload.mjs <photos-directory>");
    console.error("Example: node scripts/bulk-upload.mjs ~/Desktop/souvenir-photos");
    process.exit(1);
  }

  const absDir = resolve(photosDir);
  if (!existsSync(absDir)) {
    console.error(`❌ Directory not found: ${absDir}`);
    process.exit(1);
  }

  console.log(`\n📂 Source: ${absDir}`);
  console.log(`🔗 Supabase: ${SUPABASE_URL}\n`);

  // Get owner user ID
  const ownerId = await getOwnerUserId();
  console.log(`👤 Owner: ${ownerId}\n`);

  // Read category folders
  const folders = readdirSync(absDir).filter((name) => {
    const fullPath = join(absDir, name);
    return statSync(fullPath).isDirectory() && !name.startsWith(".");
  });

  if (!folders.length) {
    console.error("❌ No category folders found.");
    process.exit(1);
  }

  console.log(`📁 Found ${folders.length} category folders: ${folders.join(", ")}\n`);

  let totalProducts = 0;
  let totalSkipped = 0;

  for (const folder of folders) {
    // macOS uses NFD (decomposed) Unicode for filenames (ö = o + ¨)
    // Normalize to NFC (composed) to match our CATEGORY_MAP keys
    const normalizedFolder = folder.normalize("NFC");
    const catInfo = CATEGORY_MAP[normalizedFolder];
    if (!catInfo) {
      console.warn(`⚠️  Unknown category folder: "${folder}" (normalized: "${normalizedFolder}") — skipping. Add it to CATEGORY_MAP in this script.`);
      totalSkipped++;
      continue;
    }

    console.log(`\n── ${catInfo.name_de} (${catInfo.name_tr}) ──`);

    // Upsert category
    const { data: category, error: catError } = await supabase
      .from("categories")
      .upsert(
        {
          owner_id: ownerId,
          slug: catInfo.slug,
          name_tr: catInfo.name_tr,
          name_de: catInfo.name_de,
          is_active: true,
        },
        { onConflict: "owner_id,slug" }
      )
      .select("id")
      .single();

    if (catError) {
      console.error(`  ❌ Category error: ${catError.message}`);
      continue;
    }
    console.log(`  ✅ Category: ${category.id}`);

    // Read images in folder
    const folderPath = join(absDir, folder);
    const files = readdirSync(folderPath).filter((f) => {
      const ext = extname(f).toLowerCase();
      return IMAGE_EXTS.has(ext) && !f.startsWith(".");
    });

    if (!files.length) {
      console.log(`  (no images found)`);
      continue;
    }

    console.log(`  📷 ${files.length} images`);

    for (const file of files) {
      const filePath = join(folderPath, file);
      const productName = filenameToProductName(file);
      const ext = extname(file).toLowerCase();
      const storageFileName = `${catInfo.slug}/${Date.now()}-${file.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      console.log(`  📤 ${file} → "${productName}"`);

      // Optimize: resize to max 1200px + JPEG 90% quality
      const { buffer, contentType } = optimizeImage(filePath);

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(storageFileName, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error(`    ❌ Upload failed: ${uploadError.message}`);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(storageFileName);
      const imageUrl = urlData.publicUrl;

      // Insert product
      const { error: prodError } = await supabase.from("products").insert({
        owner_id: ownerId,
        category_id: category.id,
        name_tr: productName,
        name_de: productName,  // same as filename for now, shop owner can edit
        price: 0,              // shop owner enters price later
        image_url: imageUrl,
        is_active: true,
      });

      if (prodError) {
        console.error(`    ❌ DB insert failed: ${prodError.message}`);
        continue;
      }

      console.log(`    ✅ ${imageUrl.split("/").pop()}`);
      totalProducts++;
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`✅ Done! ${totalProducts} products uploaded, ${totalSkipped} folders skipped.`);
  console.log(`\nNext steps:`);
  console.log(`  1. Open the app → catalog page to see the photos`);
  console.log(`  2. Shop owner enters prices for each product`);
  console.log(`  3. Edit product names if filename-derived names aren't ideal`);
  console.log(`════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
