/**
 * Seeds nl, pl, … bg from en.ts (same keys; professional translations:
 * run `node scripts/build-locales-from-mymemory.mjs fetch <lang>` then `write <lang>`).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const enPath = path.join(root, "src/locales/en.ts");
const en = fs.readFileSync(enPath, "utf8");
const langs = [
  "nl",
  "pl",
  "sv",
  "no",
  "da",
  "fi",
  "cs",
  "ro",
  "hu",
  "el",
  "tr",
  "uk",
  "hr",
  "sk",
  "bg",
];
for (const l of langs) {
  const header = `/** ${l.toUpperCase()} — Sprint AF (seeded from EN; replace via MyMemory script or manual review) */\n`;
  const body = en.replace(/^\/\*\*[^\n]*\n/, "");
  fs.writeFileSync(path.join(root, "src/locales", `${l}.ts`), header + body, "utf8");
  console.log("wrote", l);
}
