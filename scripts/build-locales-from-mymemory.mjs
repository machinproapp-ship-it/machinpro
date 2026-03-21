/**
 * Builds value-translation maps and locale .ts files using MyMemory Translate API (free tier).
 * Run: node scripts/build-locales-from-mymemory.mjs
 * Cached in scripts/.locale-cache/ to avoid re-fetching.
 *
 * If offline or rate-limited, falls back to English for missing strings.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const cacheDir = path.join(__dirname, ".locale-cache");
fs.mkdirSync(cacheDir, { recursive: true });

const enFlat = JSON.parse(fs.readFileSync(path.join(__dirname, "en-flat.json"), "utf8"));

/** MyMemory langpair = source|target (English → locale) */
const TARGETS = {
  nl: "en|nl",
  pl: "en|pl",
  sv: "en|sv",
  no: "en|no",
  da: "en|da",
  fi: "en|fi",
  cs: "en|cs",
  ro: "en|ro",
  hu: "en|hu",
  el: "en|el",
  tr: "en|tr",
  uk: "en|uk",
  hr: "en|hr",
  sk: "en|sk",
  bg: "en|bg",
};

function cachePath(lang, text) {
  const h = Buffer.from(text).toString("base64url").slice(0, 80);
  return path.join(cacheDir, `${lang}-${h}.txt`);
}

async function translateLine(text, langPair) {
  const u = new URL("https://api.mymemory.translated.net/get");
  u.searchParams.set("q", text);
  u.searchParams.set("langpair", langPair);
  const res = await fetch(u);
  if (!res.ok) throw new Error(String(res.status));
  const j = await res.json();
  const out = j?.responseData?.translatedText;
  if (!out || j.responseStatus === 403) throw new Error("bad response");
  return out;
}

async function translateCached(text, lang) {
  const pair = TARGETS[lang];
  const cp = cachePath(lang, text);
  if (fs.existsSync(cp)) return fs.readFileSync(cp, "utf8");
  await new Promise((r) => setTimeout(r, 120));
  let t;
  try {
    t = await translateLine(text, pair);
  } catch {
    t = text;
  }
  fs.writeFileSync(cp, t, "utf8");
  return t;
}

async function buildValueMap(lang) {
  const unique = [...new Set(Object.values(enFlat))];
  const map = {};
  let i = 0;
  for (const text of unique) {
    i++;
    process.stderr.write(`\r${lang} ${i}/${unique.length}   `);
    map[text] = await translateCached(text, lang);
  }
  process.stderr.write("\n");
  const outPath = path.join(__dirname, "value-maps", `${lang}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(map, null, 2), "utf8");
  console.log("wrote", outPath);
}

function buildLocaleTs(lang) {
  const mapPath = path.join(__dirname, "value-maps", `${lang}.json`);
  const map = fs.existsSync(mapPath)
    ? JSON.parse(fs.readFileSync(mapPath, "utf8"))
    : {};
  const outObj = {};
  for (const [k, v] of Object.entries(enFlat)) {
    outObj[k] = map[v] ?? v;
  }
  const body = JSON.stringify(outObj, null, 2);
  const ts = `/** ${lang.toUpperCase()} — auto-built (value-map); review for domain terms */\nexport default ${body} as const;\n`;
  fs.writeFileSync(path.join(root, "src/locales", `${lang}.ts`), ts, "utf8");
  console.log("wrote locale", lang);
}

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === "fetch" && arg) {
  await buildValueMap(arg);
} else if (cmd === "write" && arg) {
  buildLocaleTs(arg);
} else if (cmd === "all-fetch") {
  for (const lang of Object.keys(TARGETS)) await buildValueMap(lang);
} else if (cmd === "fetch-missing") {
  for (const lang of Object.keys(TARGETS)) {
    const p = path.join(__dirname, "value-maps", `${lang}.json`);
    if (fs.existsSync(p)) {
      try {
        const j = JSON.parse(fs.readFileSync(p, "utf8"));
        if (Object.keys(j).length >= 550) {
          console.log("skip (complete map)", lang);
          continue;
        }
      } catch {
        /* refetch */
      }
    }
    await buildValueMap(lang);
  }
} else if (cmd === "all-write") {
  for (const lang of Object.keys(TARGETS)) buildLocaleTs(lang);
} else {
  console.log(`Usage:
  node scripts/build-locales-from-mymemory.mjs fetch nl
  node scripts/build-locales-from-mymemory.mjs write nl
  node scripts/build-locales-from-mymemory.mjs all-fetch
  node scripts/build-locales-from-mymemory.mjs fetch-missing
  node scripts/build-locales-from-mymemory.mjs all-write`);
}
