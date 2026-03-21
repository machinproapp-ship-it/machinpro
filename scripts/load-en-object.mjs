import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadEnObject() {
  const raw = fs.readFileSync(path.join(__dirname, "../src/locales/en.ts"), "utf8");
  const clean = raw
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "")
    .replace(/^export default\s+/, "")
    .replace(/\s+as const;\s*$/, "");
  return (0, eval)("(" + clean + ")");
}
