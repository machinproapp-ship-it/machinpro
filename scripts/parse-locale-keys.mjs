/**
 * Extract key -> value from locales/en.ts (same shape as other locales).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enPath = path.join(__dirname, "../src/locales/en.ts");
const raw = fs.readFileSync(enPath, "utf8");
const re = /^\s+(?:(\w+)|"(\w+)"):\s*"((?:[^"\\]|\\.)*)",?\s*$/gm;
const out = {};
let m;
while ((m = re.exec(raw))) {
  const key = m[1] || m[2];
  const val = m[3].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  out[key] = val;
}
fs.writeFileSync(
  path.join(__dirname, "en-keys.json"),
  JSON.stringify(out, null, 0),
  "utf8"
);
console.log("keys:", Object.keys(out).length);
