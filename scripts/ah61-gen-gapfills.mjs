/**
 * AH-61: Build src/locales/gapFill/ah61-*.ts from gaps vs en.ts (MyMemory API).
 * Usage: node scripts/ah61-gen-gapfills.mjs [es|fr|de|it|pt ...]
 * Default: all languages. Requires scripts/.ah61-tmp/gaps-from-en.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const gapsPath = path.join(root, "scripts", ".ah61-tmp", "gaps-from-en.json");
const outDir = path.join(root, "src", "locales", "gapFill");

const LANGPAIR = {
  es: "en|es",
  fr: "en|fr",
  de: "en|de",
  it: "en|it",
  pt: "en|pt",
};

/** Post-fix known MT errors for module titles (same EN phrase → wrong sense). */
const POST_FIX = {
  es: {
    demo_module_central_title: "Central",
    help_mod_office_title: "Central",
    demo_module_logistics_title: "Logística",
    help_mod_warehouse_title: "Logística",
    dashboard_quick_actions_title: "Acciones rápidas",
  },
  fr: {
    demo_module_central_title: "Central",
    help_mod_office_title: "Central",
    demo_module_logistics_title: "Logistique",
    help_mod_warehouse_title: "Logistique",
  },
  de: {
    demo_module_central_title: "Zentrale",
    help_mod_office_title: "Zentrale",
    demo_module_logistics_title: "Logistik",
    help_mod_warehouse_title: "Logistik",
  },
  it: {
    demo_module_central_title: "Centrale",
    help_mod_office_title: "Centrale",
    demo_module_logistics_title: "Logistica",
    help_mod_warehouse_title: "Logistica",
  },
  pt: {
    demo_module_central_title: "Central",
    help_mod_office_title: "Central",
    demo_module_logistics_title: "Logística",
    help_mod_warehouse_title: "Logística",
  },
};

function escTs(s) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "\\n");
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateOnce(text, pair) {
  const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${pair}`;
  const res = await fetch(u);
  if (res.status === 429) throw new Error("429");
  if (!res.ok) throw new Error(String(res.status));
  const j = await res.json();
  const out = j?.responseData?.translatedText;
  if (!out || typeof out !== "string") throw new Error(JSON.stringify(j).slice(0, 200));
  return out;
}

async function translate(text, pair) {
  let lastErr;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await translateOnce(text, pair);
    } catch (e) {
      lastErr = e;
      const wait = e.message === "429" ? 12_000 + attempt * 4000 : 3000;
      console.warn("retry", attempt + 1, e.message, "wait", wait);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function main() {
  const want = process.argv.slice(2).filter(Boolean);
  const langs = want.length ? want : ["es", "fr", "de", "it", "pt"];

  if (!fs.existsSync(gapsPath)) {
    console.error("Missing", gapsPath, "— run: npx tsx scripts/ah61-export-gaps.ts");
    process.exit(1);
  }
  const gaps = JSON.parse(fs.readFileSync(gapsPath, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });

  for (const lang of langs) {
    const pair = LANGPAIR[lang];
    if (!pair) {
      console.error("Unknown lang", lang);
      continue;
    }
    const missing = gaps[lang];
    const keys = Object.keys(missing).sort();
    const translated = {};
    const fix = POST_FIX[lang] ?? {};
    console.log(lang, keys.length, "keys");
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const enText = missing[k];
      try {
        let t = await translate(enText, pair);
        if (fix[k]) t = fix[k];
        translated[k] = t;
        if (i % 15 === 0) console.log(" ", i + 1, "/", keys.length);
      } catch (e) {
        console.error(k, e.message);
        translated[k] = fix[k] ?? enText;
      }
      await sleep(2200);
    }
    const varName = `AH61_GAP_${lang.toUpperCase()}`;
    const lines = [
      `/** AH-61: keys in en.ts missing from ${lang}.ts before sync; merged in i18n. Machine-translated — review marketing/legal strings. */`,
      `export const ${varName}: Record<string, string> = {`,
    ];
    for (const k of keys) {
      lines.push(`  ${k}: "${escTs(translated[k])}",`);
    }
    lines.push(`};`);
    fs.writeFileSync(path.join(outDir, `ah61-${lang}.ts`), lines.join("\n") + "\n", "utf8");
    console.log("Wrote", path.join("src/locales/gapFill", `ah61-${lang}.ts`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
