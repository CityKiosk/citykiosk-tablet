// Render each PDF page to a PNG using mupdf (WASM).
// Usage: node scripts/render-pdf.mjs <pdfPath> <outDir> [dpi]
import fs from "node:fs";
import path from "node:path";

const pdfPath = process.argv[2];
const outDir = process.argv[3] || "pdf-pages";
const dpi = parseInt(process.argv[4] || "110", 10);

if (!pdfPath) {
  console.error("Usage: node scripts/render-pdf.mjs <pdfPath> <outDir> [dpi]");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const mupdf = await import("mupdf");
const data = fs.readFileSync(pdfPath);
const doc = mupdf.Document.openDocument(data, "application/pdf");
const pageCount = doc.countPages();
console.log(`Pages: ${pageCount}`);

const scale = dpi / 72;
const matrix = [scale, 0, 0, scale, 0, 0];

const allText = [];
for (let i = 0; i < pageCount; i++) {
  const page = doc.loadPage(i);
  // Text
  try {
    const txt = page.toStructuredText("preserve-whitespace").asText();
    allText.push(`\n===== PAGE ${i + 1} =====\n${txt}`);
  } catch (e) {
    allText.push(`\n===== PAGE ${i + 1} =====\n[text error]`);
  }
  // Image
  try {
    const pix = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
    const png = pix.asPNG();
    const fname = path.join(outDir, `page_${String(i + 1).padStart(3, "0")}.png`);
    fs.writeFileSync(fname, png);
    pix.destroy?.();
  } catch (e) {
    console.error(`page ${i + 1} render failed:`, e.message);
  }
  page.destroy?.();
}

fs.writeFileSync(path.join(outDir, "text.txt"), allText.join("\n"));
console.log(`Rendered ${pageCount} pages → ${outDir}`);
