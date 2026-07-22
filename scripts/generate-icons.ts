import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_SVG = path.join(ROOT, "public/icons/icon-mark.svg");
const OUT_DIR = path.join(ROOT, "public/icons");

// Sizes required across manifest icons, apple-touch-icon, and favicon.
// Kept to the minimum set that covers iOS/Android home-screen + tab icon
// needs — every PNG here is a few KB, well within the <1MB asset budget.
const SIZES = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512, maskablePadding: true },
  { name: "apple-touch-icon.png", size: 180 },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const svg = await readFile(SRC_SVG);

  for (const { name, size, maskablePadding } of SIZES) {
    const pipeline = sharp(svg, { density: 384 }).resize(size, size);

    if (maskablePadding) {
      // Android maskable icons get cropped to a circle/squircle by the OS.
      // Pad ~20% so the mark survives the safe-zone crop.
      const padded = Math.round(size * 0.2);
      const inner = size - padded * 2;
      const buf = await sharp(svg, { density: 384 })
        .resize(inner, inner)
        .extend({
          top: padded,
          bottom: padded,
          left: padded,
          right: padded,
          background: "#09090b",
        })
        .png()
        .toBuffer();
      await sharp(buf).toFile(path.join(OUT_DIR, name));
      console.log(`generated ${name} (${size}x${size}, maskable)`);
      continue;
    }

    await pipeline.png().toFile(path.join(OUT_DIR, name));
    console.log(`generated ${name} (${size}x${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
