import fs from "fs";
import path from "path";
import en from "../src/locales/en";
import es from "../src/locales/es";
import fr from "../src/locales/fr";
import de from "../src/locales/de";
import it from "../src/locales/it";
import pt from "../src/locales/pt";

const packs = { es, fr, de, it, pt } as const;
const out: Record<string, Record<string, string>> = {};
for (const [code, loc] of Object.entries(packs)) {
  const missing: Record<string, string> = {};
  for (const k of Object.keys(en)) {
    if (!(k in loc)) {
      const v = (en as Record<string, unknown>)[k];
      if (typeof v === "string") missing[k] = v;
    }
  }
  out[code] = missing;
}
const dir = path.join(__dirname, ".ah61-tmp");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "gaps-from-en.json"), JSON.stringify(out, null, 2), "utf8");
for (const [code, m] of Object.entries(out)) {
  console.log(code, Object.keys(m).length);
}
