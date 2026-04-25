// Run: npx tsx scripts/normalize-category-fields.ts
// Makes products within same category share: price, dimensions, packaging_unit
// Based on real-world catalog conventions (like City Kiosk Katalog Februar 2020)

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Template values per category type (by name slug)
// If category name matches, use these defaults. Otherwise randomize at category level.
const templates: Record<string, { price: number; dimensions: string; packaging_unit: number; sku_prefix: string }> = {
  "foto": { price: 0.49, dimensions: "85 mm x 55 mm", packaging_unit: 12, sku_prefix: "100" },
  "flex": { price: 0.29, dimensions: "85 mm x 55 mm", packaging_unit: 12, sku_prefix: "110" },
  "stein": { price: 0.89, dimensions: "60 mm x 45 mm", packaging_unit: 12, sku_prefix: "120" },
  "blech": { price: 0.89, dimensions: "75 mm x 55 mm", packaging_unit: 12, sku_prefix: "130" },
  "flaschen": { price: 0.89, dimensions: "90 mm x 45 mm", packaging_unit: 12, sku_prefix: "150" },
  "holz": { price: 0.89, dimensions: "115 mm x 40 mm", packaging_unit: 6, sku_prefix: "190" },
  "postkart": { price: 0.49, dimensions: "150 mm x 100 mm", packaging_unit: 6, sku_prefix: "200" },
  "tasche": { price: 1.19, dimensions: "100 mm x 165 mm", packaging_unit: 6, sku_prefix: "350" },
  "damen": { price: 1.49, dimensions: "100 mm x 140 mm", packaging_unit: 6, sku_prefix: "380" },
  "lesezeichen": { price: 0.79, dimensions: "145 mm x 40 mm", packaging_unit: 12, sku_prefix: "400" },
  "blechschild": { price: 1.99, dimensions: "295 mm x 145 mm", packaging_unit: 6, sku_prefix: "600" },
  "untersetzer": { price: 0.99, dimensions: "97 mm x 97 mm", packaging_unit: 6, sku_prefix: "710" },
  "stift": { price: 1.49, dimensions: "140 mm x 10 mm", packaging_unit: 12, sku_prefix: "250" },
  "schlüssel": { price: 1.29, dimensions: "50 mm x 35 mm", packaging_unit: 12, sku_prefix: "300" },
  "becher": { price: 2.99, dimensions: "80 mm x 95 mm", packaging_unit: 6, sku_prefix: "450" },
};

// Fallback templates if no match — varied per category
const fallbackPool = [
  { price: 0.79, dimensions: "60 mm x 60 mm", packaging_unit: 12 },
  { price: 1.19, dimensions: "80 mm x 50 mm", packaging_unit: 6 },
  { price: 1.49, dimensions: "100 mm x 70 mm", packaging_unit: 6 },
  { price: 2.29, dimensions: "120 mm x 80 mm", packaging_unit: 6 },
  { price: 0.39, dimensions: "50 mm x 50 mm", packaging_unit: 12 },
];

function pickTemplate(catName: string, index: number): { price: number; dimensions: string; packaging_unit: number; sku_prefix: string } {
  const lower = catName.toLowerCase();
  for (const [key, tpl] of Object.entries(templates)) {
    if (lower.includes(key)) return tpl;
  }
  // fallback — pick deterministically based on index so same category always gets same values
  const f = fallbackPool[index % fallbackPool.length];
  return { ...f, sku_prefix: String(500 + (index % 10) * 10) };
}

async function main() {
  const { data: categories, error: catErr } = await supabase
    .from("categories")
    .select("id, name_de, name_tr")
    .order("name_de");

  if (catErr) { console.error(catErr); process.exit(1); }
  console.log(`Found ${categories.length} categories`);

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const name = cat.name_de || cat.name_tr;
    const tpl = pickTemplate(name, i);

    // Fetch products in this category
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id")
      .eq("category_id", cat.id)
      .order("created_at");

    if (prodErr) { console.error(prodErr); continue; }
    if (!products || products.length === 0) continue;

    console.log(`\n${name} (${products.length} items) → ${tpl.price.toFixed(2)} € | ${tpl.dimensions} | VE ${tpl.packaging_unit} | Art.-Nr. ${tpl.sku_prefix}xxx`);

    // Update each product with category-consistent values + sequential SKU
    for (let j = 0; j < products.length; j++) {
      const sku = `${tpl.sku_prefix}${String(j + 1).padStart(3, "0")}`;
      const { error } = await supabase
        .from("products")
        .update({
          price: tpl.price,
          dimensions: tpl.dimensions,
          packaging_unit: tpl.packaging_unit,
          sku,
        })
        .eq("id", products[j].id);

      if (error) console.error(`  Failed ${products[j].id}: ${error.message}`);
    }
  }

  console.log("\nDone!");
}

main();
