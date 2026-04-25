// Run: npx tsx scripts/seed-products.ts
// Updates all products with random Art.-Nr., description, and price (0–4 EUR)

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const descriptions = [
  "Blechschildmagnete 75 mm x 55 mm VE1",
  "Schlüsselanhänger Metall Berlin 4 cm",
  "Kühlschrankmagnet Polyresin 6 cm",
  "Schneekugel Berlin 6,5 cm mit Glitzer",
  "Postkarte Berlin Sehenswürdigkeiten A6",
  "Flaschenöffner Metall Brandenburger Tor",
  "Miniatur Berliner Bär handbemalt 5 cm",
  "Tasse Keramik Berlin Skyline 300 ml",
  "Sticker Set Berlin 10 Stück sortiert",
  "Anstecknadel Pin Berliner Fernsehturm",
  "Einkaufstasche Baumwolle Berlin Motiv",
  "Kugelschreiber Berlin Metall schwarz",
  "Feuerzeug Berlin mit Stadtmotiv",
  "Untersetzer Kork Berlin Motive 4er Set",
  "Notizbuch A5 Berlin Hardcover liniert",
  "Spielkarten Berlin 52 Blatt + Joker",
  "Thimble Porzellan Fingerhut Berlin",
  "Aufnäher Berlin Bär gestickt 7 cm",
  "Lineal Metall 15 cm Berlin Motive",
  "Bleistift Set Berlin 6 Stück HB",
];

async function main() {
  const { data: products, error } = await supabase
    .from("products")
    .select("id")
    .order("created_at");

  if (error) {
    console.error("Fetch error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${products.length} products, updating...`);

  for (const p of products) {
    const sku = String(100000 + Math.floor(Math.random() * 900000)); // 6-digit
    const desc = descriptions[Math.floor(Math.random() * descriptions.length)];
    const price = Math.round((Math.random() * 4 + 0.1) * 100) / 100; // 0.10–4.10

    const w = Math.floor(Math.random() * 80 + 20); // 20–100 mm
    const h = Math.floor(Math.random() * 80 + 20);
    const dimensions = `${w} mm x ${h} mm`;

    const { error: updateErr } = await supabase
      .from("products")
      .update({ sku, description_de: desc, price, dimensions })
      .eq("id", p.id);

    if (updateErr) {
      console.error(`Error updating ${p.id}:`, updateErr.message);
    } else {
      console.log(`${p.id} → Art.-Nr. ${sku} | ${price.toFixed(2)} € | ${dimensions} | ${desc}`);
    }
  }

  console.log("Done!");
}

main();
