/**
 * Screenshot ancho 1280x720 para el manifest (store / marketing).
 * Uso: node scripts/generate-pwa-screenshot.mjs
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "public", "screenshots");
const w = 1280;
const h = 720;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f97316"/>
      <stop offset="100%" style="stop-color:#ea580c"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#f4f4f5"/>
  <rect x="0" y="0" width="${w}" height="120" fill="url(#g)"/>
  <text x="48" y="78" fill="#ffffff" font-family="system-ui,Segoe UI,sans-serif" font-size="42" font-weight="700">MachinPro</text>
  <text x="48" y="220" fill="#18181b" font-family="system-ui,Segoe UI,sans-serif" font-size="28" font-weight="600">Dashboard</text>
  <rect x="48" y="260" width="520" height="200" rx="16" fill="#ffffff" stroke="#e4e4e7" stroke-width="2"/>
  <rect x="600" y="260" width="632" height="380" rx="16" fill="#ffffff" stroke="#e4e4e7" stroke-width="2"/>
</svg>`;

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const out = path.join(dir, "dashboard.png");
await sharp(Buffer.from(svg)).png().toFile(out);
console.log("✓", path.relative(root, out));
