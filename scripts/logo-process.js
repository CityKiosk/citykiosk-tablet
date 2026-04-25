// Usage: node scripts/logo-process.js /absolute/path/to/source-logo.jpg
// Falls back to ./logo-source.jpg in the project root if no arg given.
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC = process.argv[2] || path.join(__dirname, "..", "logo-source.jpg");
const OUT_DIR = path.join(__dirname, "..", "public");

// Near-white threshold. Pixels whose R,G,B are all >= THRESHOLD become
// transparent. Softer: fade the alpha between THRESHOLD and FULL_WHITE so
// anti-aliased edges don't look crunchy.
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
      // linear fade between THRESHOLD (255 alpha) and FULL_WHITE (0 alpha)
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

  const sizes = [
    { name: "logo.png", size: 1024 },
    { name: "logo-512.png", size: 512 },
    { name: "logo-192.png", size: 192 },
    { name: "favicon.png", size: 192 },
  ];

  for (const { name, size } of sizes) {
    const out = path.join(OUT_DIR, name);
    await sharp(basePngBuf)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(out);
    const { size: bytes } = fs.statSync(out);
    console.log(`wrote ${name} (${size}x${size}, ${bytes} bytes)`);
  }

  // Solid-background variants. Android PWA masking ("maskable" purpose) and
  // iOS home-screen icons (apple-touch-icon) both need a non-transparent
  // background and a safe zone — iOS shows transparent pixels as black, and
  // Android can clip to a circle/squircle. 72% inner size covers both.
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

  // Next.js App Router convention: src/app/icon.png is the browser-tab icon.
  // Override it with the transparent 512 version so the tab reflects the new
  // logo even when cached manifest entries are stale.
  const appIconOut = path.join(__dirname, "..", "src/app/icon.png");
  await sharp(basePngBuf)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(appIconOut);
  console.log(`wrote src/app/icon.png (512x512)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
