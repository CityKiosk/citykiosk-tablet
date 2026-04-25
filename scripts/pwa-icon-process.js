// ============================================================================
// PWA install-icon processor (home-screen / launcher icon)
// ============================================================================
// Processes a SOURCE image (with white background) into the three files the
// PWA installs use:
//   - public/logo-maskable-192.png   Android, manifest `maskable` purpose
//   - public/logo-maskable-512.png   Android, manifest `maskable` purpose
//   - public/apple-touch-icon.png    iOS home-screen icon (180×180)
//
// Keeps in-app logos (logo-192/512/.png, favicon.png, src/app/icon.png)
// untouched so the sidebar + browser-tab mark stay on the SockOff design.
//
// Usage: node scripts/pwa-icon-process.js /absolute/path/to/source-icon.jpg
// Falls back to ./pwa-icon-source.jpg in the project root if no arg given.
// ============================================================================

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC = process.argv[2] || path.join(__dirname, "..", "pwa-icon-source.jpg");
const OUT_DIR = path.join(__dirname, "..", "public");

const THRESHOLD = 235;
const FULL_WHITE = 252;

async function makeTransparent(bufJpeg) {
  const { data, info } = await sharp(bufJpeg)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) throw new Error("expected RGBA raw output");

  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const minC = Math.min(r, g, b);
    if (minC >= FULL_WHITE) {
      out[i + 3] = 0;
    } else if (minC >= THRESHOLD) {
      const t = (minC - THRESHOLD) / (FULL_WHITE - THRESHOLD);
      out[i + 3] = Math.round(255 * (1 - t));
    }
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png();
}

async function main() {
  const src = fs.readFileSync(SRC);
  const base = await makeTransparent(src);
  const basePngBuf = await base.toBuffer();

  // Solid-bg variants (72% inner zone). Android maskable icons get cropped
  // to a circle/squircle, iOS renders transparent pixels as black — both
  // want a white backdrop plus padding for safety.
  const solidBgSizes = [
    { name: "logo-maskable-192.png", size: 192 },
    { name: "logo-maskable-512.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
  ];

  for (const { name, size } of solidBgSizes) {
    const inner = Math.round(size * 0.72);
    const innerBuf = await sharp(basePngBuf)
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const out = path.join(OUT_DIR, name);
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: innerBuf, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toFile(out);
    const { size: bytes } = fs.statSync(out);
    console.log(`wrote ${name} (${size}x${size}, ${bytes} bytes)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
