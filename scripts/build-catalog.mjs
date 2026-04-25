// Crop all PDF pages into product images, parse metadata, emit data.ts
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const TEXT = fs.readFileSync("pdf-pages/text.txt", "utf8");
const PAGES_DIR = "pdf-pages";
const IMG_OUT = "public/products";
fs.mkdirSync(IMG_OUT, { recursive: true });

// Crop grid (2 cols x 5 rows) at 110 DPI page (910x1287)
const cols = [
  { x: 60, w: 290 },
  { x: 460, w: 290 },
];
const rowYs = [145, 360, 568, 788, 998];
const rowH = 185;
const slots = []; // row-major
for (const y of rowYs) for (const c of cols) slots.push({ x: c.x, y, w: c.w, h: rowH });

// Parse text into per-page records
function parsePages() {
  const parts = TEXT.split(/===== PAGE (\d+) =====/).slice(1);
  const map = new Map();
  for (let i = 0; i < parts.length; i += 2) {
    const num = parseInt(parts[i]);
    const body = parts[i + 1] || "";
    // Art-Nr: any 6-digit number following "Art.-Nr."
    const artMatches = [...body.matchAll(/Art\.-Nr\.[\s\n]*(\d{6})/g)].map((m) => m[1]);
    // Filter out RÜCKSEITE placeholder slot — already excluded by digit-only regex
    // Price: standalone "X,XX" line near top
    const priceMatch = body.match(/^\s*(\d+,\d{2})\s*$/m);
    // Title: line containing "VE" with dimensions
    const titleMatch = body.match(/([A-ZÄÖÜ][\wäöüÄÖÜß\-,. ]+?)\s*(\d+\s*(?:mm|m)?\s*x\s*\d+\s*(?:mm)?[^V]*)\s*VE\s*(\d+)/);
    map.set(num, {
      page: num,
      arts: artMatches,
      price: priceMatch ? priceMatch[1] : null,
      title: titleMatch ? titleMatch[1].trim() : null,
      dim: titleMatch ? titleMatch[2].trim() : null,
      ve: titleMatch ? parseInt(titleMatch[3]) : null,
    });
  }
  return map;
}

const pageData = parsePages();

// Manual category map: page range → { categoryId, name (TR), titleTemplate (TR) }
// Built from grep of text.txt section markers
const ranges = [
  { from: 3, to: 11, cat: "foto-magnet", catName: "Foto Magnetler", title: "Berlin Foto Magnet" },
  { from: 12, to: 14, cat: "foto-magnet-premium", catName: "Premium Foto Magnetler", title: "Premium Foto Magnet" },
  { from: 15, to: 22, cat: "flex-magnet", catName: "Flex Magnetler", title: "Berlin Flex Magnet" },
  { from: 23, to: 29, cat: "tas-magnet", catName: "Taş Magnetler", title: "Berlin Taş Magnet" },
  { from: 30, to: 34, cat: "duvar-magnet", catName: "Duvar Görünümlü Magnetler", title: "Berlin Duvar Magnet" },
  { from: 35, to: 38, cat: "mini-epoxy", catName: "Mini Epoxy Magnetler", title: "Mini Epoxy Magnet" },
  { from: 39, to: 42, cat: "acacak-magnet", catName: "Açacak Magnetler", title: "Şişe Açacaklı Magnet" },
  { from: 43, to: 46, cat: "ahsap-magnet", catName: "Ahşap Magnetler", title: "Ahşap Magnet" },
  { from: 47, to: 47, cat: "kitap-ayraci-magnet", catName: "Magnetli Kitap Ayraçları", title: "Magnetli Kitap Ayracı" },
  { from: 48, to: 50, cat: "kartpostal", catName: "Kartpostallar", title: "Berlin Kartpostal" },
  { from: 51, to: 56, cat: "kitap-ayraci", catName: "Kitap Ayraçları", title: "Berlin Kitap Ayracı" },
  { from: 57, to: 57, cat: "saat", catName: "Magnetli Saatler", title: "Berlin Magnetli Saat" },
  { from: 58, to: 59, cat: "bez-canta", catName: "Bez Çantalar", title: "Berlin Bez Çanta" },
  { from: 60, to: 62, cat: "bardak-altligi", catName: "Bardak Altlıkları", title: "Berlin Bardak Altlığı" },
  { from: 63, to: 65, cat: "kucuk-canta", catName: "Küçük Çantalar", title: "Berlin Küçük Çanta" },
  { from: 66, to: 67, cat: "makyaj-cantasi", catName: "Makyaj Çantaları", title: "Berlin Makyaj Çantası" },
  { from: 68, to: 68, cat: "kucuk-canta", catName: "Küçük Çantalar", title: "Berlin Küçük Çanta" },
  { from: 69, to: 70, cat: "ipad-canta", catName: "iPad Çantaları", title: "Berlin iPad Çantası" },
  { from: 71, to: 72, cat: "anahtarlik", catName: "Anahtarlıklar", title: "Berlin Anahtarlık" },
  { from: 73, to: 73, cat: "tas-puzzle", catName: "Taş Puzzle", title: "Berlin Taş Puzzle" },
  { from: 74, to: 75, cat: "metal-tabela", catName: "Metal Tabelalar", title: "Berlin Metal Tabela" },
  { from: 76, to: 79, cat: "zeytin-sabunu", catName: "Zeytin Sabunlu Metal Kutu", title: "Zeytin Sabunlu Metal Kutu" },
  { from: 80, to: 81, cat: "tas-tabak", catName: "Taş Tabak", title: "Berlin Taş Tabak" },
  { from: 82, to: 82, cat: "ahsap-magnet-uzun", catName: "Uzun Ahşap Magnetler", title: "Uzun Ahşap Magnet" },
  { from: 83, to: 85, cat: "ahsap-kartpostal", catName: "Ahşap Kartpostallar", title: "Ahşap Kartpostal" },
];

function categoryFor(pg) {
  return ranges.find((r) => pg >= r.from && pg <= r.to);
}

// Crop & emit
const products = [];
const cats = new Map();

for (const [pg, data] of pageData) {
  if (data.arts.length === 0) continue;
  const cat = categoryFor(pg);
  if (!cat) continue;
  if (!cats.has(cat.cat)) cats.set(cat.cat, cat.catName);

  const pageImg = path.join(PAGES_DIR, `page_${String(pg).padStart(3, "0")}.png`);
  const buf = fs.readFileSync(pageImg);

  const n = Math.min(data.arts.length, slots.length);
  for (let i = 0; i < n; i++) {
    const slot = slots[i];
    const art = data.arts[i];
    const fname = `${art}.jpg`;
    const outPath = path.join(IMG_OUT, fname);
    await sharp(buf)
      .extract({ left: slot.x, top: slot.y, width: slot.w, height: slot.h })
      .resize({ width: 600, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(outPath);

    const priceNum = data.price ? parseFloat(data.price.replace(",", ".")) : 0;
    products.push({
      id: art,
      name: `${cat.title} ${art}`,
      description: `Art-Nr ${art}${data.dim ? " — " + data.dim : ""}${data.ve ? " — Paket " + data.ve + " adet" : ""}`,
      image: `/products/${fname}`,
      categoryId: cat.cat,
      price: priceNum,
    });
  }
  console.log(`page ${pg} → ${n} products`);
}

// Emit data.ts
const catsArr = [...cats].map(([id, name]) => ({ id, name }));
const file = `import { Category, Product } from "./types";

export const categories: Category[] = ${JSON.stringify(catsArr, null, 2)};

export const products: Product[] = ${JSON.stringify(products, null, 2)};
`;
fs.writeFileSync("src/lib/data.ts", file);
console.log(`\nDone. ${products.length} products, ${catsArr.length} categories.`);
