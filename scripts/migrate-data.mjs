// Read existing data.ts, convert to new shape (Category.nameTr/nameDe, Product dim/ve).
import fs from "node:fs";

// We import the JS-evaluated form by stripping the import line.
const src = fs.readFileSync("src/lib/data.ts", "utf8");
// Strip TS types and import; extract JSON arrays
const catMatch = src.match(/categories:\s*Category\[\]\s*=\s*(\[[\s\S]*?\n\]);/);
const prodMatch = src.match(/products:\s*Product\[\]\s*=\s*(\[[\s\S]*\n\]);/);
const cats = JSON.parse(catMatch[1]);
const prods = JSON.parse(prodMatch[1]);

const deNames = {
  "foto-magnet": "Fotomagnete",
  "foto-magnet-premium": "Fotomagnete Premium",
  "flex-magnet": "Flexmagnete",
  "tas-magnet": "Steinmagnete",
  "duvar-magnet": "Mauer-Look Magnete",
  "mini-epoxy": "Mini-Magnete Epoxy",
  "acacak-magnet": "Magnete Flaschenöffner",
  "ahsap-magnet": "Holz-Magnete",
  "kitap-ayraci-magnet": "Lesezeichen Magnet",
  "kartpostal": "Postkarten",
  "kitap-ayraci": "Lesezeichen",
  "saat": "Uhren mit Magnet",
  "bez-canta": "Baumwolltaschen",
  "bardak-altligi": "Untersetzer",
  "kucuk-canta": "Kleine Taschen",
  "makyaj-cantasi": "Kosmetiktaschen",
  "ipad-canta": "Taschen für iPad",
  "anahtarlik": "Schlüsselanhänger",
  "tas-puzzle": "Steinpuzzle",
  "metal-tabela": "Blechschilder",
  "zeytin-sabunu": "Metalldosen mit Olivenseife",
  "tas-tabak": "Steinteller",
  "ahsap-magnet-uzun": "Lange Holzmagnete",
  "ahsap-kartpostal": "Holz-Postkarten",
};

const newCats = cats.map((c) => ({
  id: c.id,
  nameTr: c.name,
  nameDe: deNames[c.id] || c.name,
}));

const newProds = prods.map((p) => {
  // description: "Art-Nr 100050 — 85 mm x 55 mm — Paket 12 adet"
  const m = p.description?.match(/Art-Nr\s+\d+\s*—\s*(.+?)\s*—\s*Paket\s+(\d+)\s*adet/);
  const dim = m ? m[1].trim() : undefined;
  const ve = m ? parseInt(m[2]) : undefined;
  return {
    id: p.id,
    image: p.image,
    categoryId: p.categoryId,
    price: p.price,
    ...(dim ? { dim } : {}),
    ...(ve ? { ve } : {}),
  };
});

const file = `import { Category, Product } from "./types";

export const categories: Category[] = ${JSON.stringify(newCats, null, 2)};

export const products: Product[] = ${JSON.stringify(newProds, null, 2)};
`;
fs.writeFileSync("src/lib/data.ts", file);
console.log(`migrated: ${newCats.length} categories, ${newProds.length} products`);
