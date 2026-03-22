/**
 * Genera iconos PWA (fondo #f97316, M blanca, esquinas redondeadas) con sharp + SVG.
 * Uso: node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const iconsDir = path.join(root, "public", "icons");
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function iconSvg(size) {
  const r = Math.round(size * 0.2);
  const fsz = Math.round(size * 0.52);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#f97316"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#ffffff" font-family="system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-weight="800" font-size="${fsz}">M</text>
</svg>`;
}

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

await Promise.all(
  sizes.map(async (size) => {
    const out = path.join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(Buffer.from(iconSvg(size))).png().toFile(out);
    console.log("✓", path.relative(root, out));
  })
);

console.log("Done.");
