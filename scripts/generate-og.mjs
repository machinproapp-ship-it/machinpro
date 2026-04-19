/**
 * Generates Open Graph image 1200×630 WebP from logo + gradient (run: node scripts/generate-og.mjs).
 */
import sharp from "sharp";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "public", "og-machinpro.webp");
const logoPath = join(root, "public", "logo-source.png");

async function main() {
  const logoBuf = await readFile(logoPath);
  const logoResized = await sharp(logoBuf)
    .resize({ width: 320, height: 320, fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const meta = await sharp(logoResized).metadata();
  const lw = meta.width ?? 320;
  const lh = meta.height ?? 320;

  const svgBg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#134e5e"/>
      <stop offset="100%" style="stop-color:#071a20"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
</svg>`;

  const bg = Buffer.from(svgBg);
  await sharp(bg)
    .composite([
      {
        input: logoResized,
        left: Math.round((1200 - lw) / 2),
        top: Math.round((630 - lh) / 2) - 28,
      },
    ])
    .webp({ quality: 88 })
    .toFile(outPath);

  console.log("Wrote", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
