// Run: npx tsx scripts/reset-and-seed-from-photos.ts
// 1. Delete all products + categories + storage objects
// 2. Re-create categories & products from ~/Desktop/souvenir_photos/
// 3. Apply category-consistent templates (price, dimensions, VE, SKU prefix)

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PHOTOS_ROOT = path.join(os.homedir(), "Desktop", "souvenir_photos");

// Category templates — name (as folder) → { tr/de names, slug, price, dims, VE, SKU prefix }
const categoryTemplates: Record<string, {
  name_de: string;
  name_tr: string;
  slug: string;
  price: number;
  dimensions: string;
  packaging_unit: number;
  sku_prefix: string;
}> = {
  "Flaschenöffner":   { name_de: "Flaschenöffner",   name_tr: "Şişe Açacağı",    slug: "flaschenoeffner",   price: 0.89, dimensions: "90 mm x 45 mm",  packaging_unit: 12, sku_prefix: "150" },
  "Fotomagnete":      { name_de: "Fotomagnete",      name_tr: "Foto Mıknatıs",   slug: "fotomagnete",       price: 0.49, dimensions: "85 mm x 55 mm",  packaging_unit: 12, sku_prefix: "100" },
  "Haarklemmen":      { name_de: "Haarklemmen",      name_tr: "Saç Tokası",      slug: "haarklemmen",       price: 1.49, dimensions: "100 mm x 70 mm", packaging_unit: 6,  sku_prefix: "520" },
  "Mauerlook":        { name_de: "Mauerlook",        name_tr: "Duvar Görünümü",  slug: "mauerlook",         price: 2.29, dimensions: "120 mm x 80 mm", packaging_unit: 6,  sku_prefix: "530" },
  "Metall Magnete":   { name_de: "Metall Magnete",   name_tr: "Metal Mıknatıs",  slug: "metall-magnete",    price: 0.39, dimensions: "50 mm x 50 mm",  packaging_unit: 12, sku_prefix: "540" },
  "Polymagnete PNG":  { name_de: "Polymagnete",      name_tr: "Poli Mıknatıs",   slug: "polymagnete",       price: 0.79, dimensions: "60 mm x 60 mm",  packaging_unit: 12, sku_prefix: "550" },
  "Schlüsselanhänger":{ name_de: "Schlüsselanhänger",name_tr: "Anahtarlık",      slug: "schluesselanhaenger",price:1.29, dimensions: "50 mm x 35 mm",  packaging_unit: 12, sku_prefix: "300" },
  "Socken Fussmodel": { name_de: "Socken",           name_tr: "Çorap",           slug: "socken",            price: 1.49, dimensions: "100 mm x 70 mm", packaging_unit: 6,  sku_prefix: "570" },
  "Steinmagnete":     { name_de: "Steinmagnete",     name_tr: "Taş Mıknatıs",    slug: "steinmagnete",      price: 0.89, dimensions: "60 mm x 45 mm",  packaging_unit: 12, sku_prefix: "120" },
  "Stifte":           { name_de: "Stifte",           name_tr: "Kalemler",        slug: "stifte",            price: 1.49, dimensions: "140 mm x 10 mm", packaging_unit: 12, sku_prefix: "250" },
};

async function resetData() {
  console.log("=== Step 1: Delete existing data ===\n");

  // Get the owner_id (we assume single user for this seed script)
  const { data: users } = await supabase.auth.admin.listUsers();
  const ownerId = users?.users?.[0]?.id;
  if (!ownerId) { console.error("No user found"); process.exit(1); }
  console.log("Owner:", ownerId);

  // Delete order_items first (FK to products)
  const { error: oiErr, count: oiCount } = await supabase
    .from("order_items")
    .delete({ count: "exact" })
    .eq("owner_id", ownerId);
  if (oiErr) console.error("order_items delete:", oiErr.message);
  else console.log(`Deleted ${oiCount ?? 0} order_items`);

  // Delete orders
  const { error: oErr, count: oCount } = await supabase
    .from("orders")
    .delete({ count: "exact" })
    .eq("owner_id", ownerId);
  if (oErr) console.error("orders delete:", oErr.message);
  else console.log(`Deleted ${oCount ?? 0} orders`);

  // Delete products
  const { error: pErr, count: pCount } = await supabase
    .from("products")
    .delete({ count: "exact" })
    .eq("owner_id", ownerId);
  if (pErr) console.error("products delete:", pErr.message);
  else console.log(`Deleted ${pCount ?? 0} products`);

  // Delete categories
  const { error: cErr, count: cCount } = await supabase
    .from("categories")
    .delete({ count: "exact" })
    .eq("owner_id", ownerId);
  if (cErr) console.error("categories delete:", cErr.message);
  else console.log(`Deleted ${cCount ?? 0} categories`);

  // Clean storage bucket
  console.log("\nCleaning storage bucket product-images...");
  async function cleanFolder(prefix = ""): Promise<number> {
    const { data: files, error } = await supabase.storage.from("product-images").list(prefix, { limit: 1000 });
    if (error) { console.error("list:", error.message); return 0; }
    if (!files || files.length === 0) return 0;
    let deleted = 0;
    for (const f of files) {
      const fullPath = prefix ? `${prefix}/${f.name}` : f.name;
      if (f.id === null) {
        // It's a subfolder
        deleted += await cleanFolder(fullPath);
      } else {
        const { error: dErr } = await supabase.storage.from("product-images").remove([fullPath]);
        if (!dErr) deleted++;
      }
    }
    return deleted;
  }
  const storageDeleted = await cleanFolder();
  console.log(`Deleted ${storageDeleted} storage files`);

  return ownerId;
}

async function seedFromPhotos(ownerId: string) {
  console.log("\n=== Step 2: Seed categories and products ===\n");

  const folders = await readdir(PHOTOS_ROOT, { withFileTypes: true });

  // Build a normalized lookup table to handle macOS NFD vs NFC unicode
  const normalizedTemplates: Record<string, typeof categoryTemplates[string]> = {};
  for (const [k, v] of Object.entries(categoryTemplates)) {
    normalizedTemplates[k.normalize("NFC")] = v;
  }

  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const folderName = folder.name;
    const tpl = normalizedTemplates[folderName.normalize("NFC")];
    if (!tpl) { console.warn(`Skipping unknown folder: ${folderName}`); continue; }

    // Create category
    const { data: cat, error: catErr } = await supabase
      .from("categories")
      .insert({
        owner_id: ownerId,
        name_de: tpl.name_de,
        name_tr: tpl.name_tr,
        slug: tpl.slug,
        is_active: true,
      })
      .select("id")
      .single();

    if (catErr) { console.error(`Category ${folderName} failed:`, catErr.message); continue; }
    console.log(`\n📁 ${tpl.name_de} (slug: ${tpl.slug})`);

    // List image files
    const folderPath = path.join(PHOTOS_ROOT, folderName);
    const files = (await readdir(folderPath))
      .filter((f) => /\.(jpe?g|png)$/i.test(f))
      .sort();

    console.log(`   Found ${files.length} images`);

    let n = 0;
    for (const file of files) {
      n++;
      const filePath = path.join(folderPath, file);
      const buffer = await readFile(filePath);

      // Resize to 1600px max, convert to JPEG (matches website upload)
      const resized = await sharp(buffer)
        .rotate() // auto-orient from EXIF
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true }) // mozjpeg: ~20% smaller at same quality
        .toBuffer();

      // Upload to Storage
      const storageFileName = `${ownerId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(storageFileName, resized, { contentType: "image/jpeg", upsert: false });

      if (upErr) { console.error(`  Upload ${file}:`, upErr.message); continue; }

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(storageFileName);

      // Insert product
      const sku = `${tpl.sku_prefix}${String(n).padStart(3, "0")}`;
      const productName = `${tpl.name_de} ${n}`;

      const { error: prodErr } = await supabase.from("products").insert({
        owner_id: ownerId,
        category_id: cat.id,
        name_de: productName,
        name_tr: productName,
        price: tpl.price,
        image_url: urlData.publicUrl,
        dimensions: tpl.dimensions,
        packaging_unit: tpl.packaging_unit,
        sku,
        sort_order: n,
        is_active: true,
      });

      if (prodErr) { console.error(`  Insert ${file}:`, prodErr.message); continue; }

      if (n % 10 === 0 || n === files.length) {
        process.stdout.write(`   ${n}/${files.length}\n`);
      }
    }

    console.log(`   ✓ ${n} products added (SKU ${tpl.sku_prefix}001 → ${tpl.sku_prefix}${String(n).padStart(3, "0")})`);
  }

  console.log("\n✅ Done!");
}

async function main() {
  const ownerId = await resetData();
  await seedFromPhotos(ownerId);
}

main().catch((e) => { console.error(e); process.exit(1); });
