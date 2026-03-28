/**
 * Sync locale files to match en.ts keys. Uses Google Translate gtx (unofficial).
 * Run: node scripts/full-sync-locales.mjs --lang=nl | --base --lang=es | --all-lazy
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "..", "src", "locales");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function enPropertyOrder(enPath) {
  const src = fs.readFileSync(enPath, "utf8");
  const sf = ts.createSourceFile("en.ts", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const keys = [];
  sf.forEachChild((node) => {
    if (!ts.isExportAssignment(node)) return;
    let ex = node.expression;
    if (ts.isAsExpression(ex)) ex = ex.expression;
    if (!ts.isObjectLiteralExpression(ex)) return;
    for (const prop of ex.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const nk = prop.name;
      let key = nk.getText(sf).trim();
      if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")))
        key = JSON.parse(key.replace(/^'|'$/g, '"'));
      keys.push(key);
    }
  });
  return keys;
}

function extractStrings(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = {};
  function strVal(node) {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return null;
  }
  function walkObject(ol) {
    for (const prop of ol.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const nk = prop.name;
      let key = nk.getText(sf).trim();
      if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")))
        key = JSON.parse(key.replace(/^'|'$/g, '"'));
      const v = strVal(prop.initializer);
      if (v !== null) out[key] = v;
    }
  }
  sf.forEachChild((node) => {
    if (ts.isExportAssignment(node)) {
      let ex = node.expression;
      if (ts.isAsExpression(ex)) ex = ex.expression;
      if (ts.isObjectLiteralExpression(ex)) walkObject(ex);
    }
  });
  return out;
}

/** Chunk long strings for GET url limits */
function chunksForTranslate(s, max = 450) {
  if (s.length <= max) return [s];
  const out = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + max, s.length);
    if (end < s.length) {
      const sp = s.lastIndexOf(" ", end);
      if (sp > i + 50) end = sp + 1;
    }
    out.push(s.slice(i, end));
    i = end;
  }
  return out;
}

async function fetchGtxPart(p, tl) {
  const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(p)}`;
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const r = await fetch(u);
      if (r.ok) {
        const j = await r.json();
        return j?.[0]?.map((x) => x?.[0]).join("") ?? p;
      }
      lastErr = new Error(`gtx ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    await sleep(800 * 2 ** attempt + Math.floor(Math.random() * 400));
  }
  throw lastErr ?? new Error("gtx failed");
}

async function gtx(text, tl) {
  if (!text || text.trim() === "") return text;
  const parts = chunksForTranslate(text, 380);
  const translated = [];
  for (const p of parts) {
    const seg = await fetchGtxPart(p, tl);
    translated.push(seg);
    await sleep(120);
  }
  return translated.join("");
}

const TL = {
  es: "es",
  fr: "fr",
  de: "de",
  it: "it",
  pt: "pt",
  nl: "nl",
  pl: "pl",
  sv: "sv",
  no: "no",
  da: "da",
  fi: "fi",
  cs: "cs",
  ro: "ro",
  hu: "hu",
  el: "el",
  tr: "tr",
  uk: "uk",
  hr: "hr",
  sk: "sk",
  bg: "bg",
};

function writeLocaleFile(lang, obj, label, keyOrder) {
  const keys = keyOrder.filter((k) => k in obj);
  const lines = [
    `/** ${label} — synced to en.ts (${keys.length} keys) */`,
    "export default {",
  ];
  for (const k of keys) {
    const v = obj[k];
    lines.push(`  ${/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(v)},`);
  }
  lines.push("} as const;");
  fs.writeFileSync(path.join(localesDir, `${lang}.ts`), lines.join("\n") + "\n", "utf8");
}

async function syncLang(lang, mode) {
  const tl = TL[lang];
  if (!tl) throw new Error("unknown lang " + lang);
  const enPath = path.join(localesDir, "en.ts");
  const locPath = path.join(localesDir, `${lang}.ts`);
  const en = extractStrings(enPath);
  const keyOrder = enPropertyOrder(enPath);
  const existing = fs.existsSync(locPath) ? extractStrings(locPath) : {};
  const out = {};
  const cache = new Map();

  async function translateText(english) {
    if (cache.has(english)) return cache.get(english);
    const t = await gtx(english, tl);
    cache.set(english, t);
    return t;
  }

  let nTrans = 0;
  for (const key of keyOrder) {
    const ev = en[key];
    if (ev === undefined) continue;
    const pv = existing[key];
    let use = pv;

    if (mode === "lazy" || mode === "base") {
      if (pv === undefined || pv === ev) {
        use = await translateText(ev);
        nTrans++;
      }
    }
    out[key] = use !== undefined ? use : ev;
  }

  const label = lang.toUpperCase();
  writeLocaleFile(lang, out, label, keyOrder);
  console.log(lang, "done. translated approx", nTrans, "unique cache misses ~", cache.size);
}

const argv = process.argv.slice(2);
const allLazy = argv.includes("--all-lazy");
const base = argv.includes("--base");
const langArg = argv.find((a) => a.startsWith("--lang="))?.split("=")[1];

if (allLazy) {
  const lazy = "nl pl sv no da fi cs ro hu el tr uk hr sk bg".split(" ");
  for (const L of lazy) {
    console.log("===", L, "===");
    await syncLang(L, "lazy");
  }
} else if (langArg && base) {
  await syncLang(langArg, "base");
} else if (langArg) {
  await syncLang(langArg, "lazy");
} else {
  console.log("Usage: --all-lazy | --lang=XX | --base --lang=es");
  process.exit(1);
}
