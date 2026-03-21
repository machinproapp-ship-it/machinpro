import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pagePath = path.join(root, "src/app/page.tsx");
const lines = fs.readFileSync(pagePath, "utf8").split(/\r?\n/);

/** Line numbers are 1-based; end is inclusive (last line inside locale object) */
const blocks = [
  ["es", 144, 732],
  ["en", 735, 1323],
  ["fr", 1326, 1900],
  ["de", 1903, 2491],
  ["it", 2494, 3082],
  ["pt", 3085, 3673],
];

const outDir = path.join(root, "src/locales");
fs.mkdirSync(outDir, { recursive: true });

for (const [lang, s, e] of blocks) {
  const slice = lines.slice(s - 1, e);
  const inner = slice.map((l) => l.replace(/^    /, "")).join("\n");
  const out =
    `/** ${String(lang).toUpperCase()} — migrated from page.tsx (Sprint AF) */\n` +
    `export default {\n  ${inner.replace(/\n/g, "\n  ")}\n} as const;\n`;
  fs.writeFileSync(path.join(outDir, `${lang}.ts`), out, "utf8");
}

console.log("Wrote:", blocks.map((b) => b[0]).join(", "));
