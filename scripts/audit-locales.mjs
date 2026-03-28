/**
 * One-off audit: compare locale files to en.ts (run: node scripts/audit-locales.mjs)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "..", "src", "locales");

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

function duplicates(keys) {
  const seen = new Set();
  const d = [];
  for (const k of keys) {
    if (seen.has(k)) d.push(k);
    seen.add(k);
  }
  return d;
}

const enPath = path.join(localesDir, "en.ts");
const en = extractStrings(enPath);
const enKeys = Object.keys(en).sort();
console.log("en.ts keys:", enKeys.length);

const langs = "es fr de it pt nl pl sv no da fi cs ro hu el tr uk hr sk bg".split(" ");
const rows = [];
for (const L of langs) {
  const fp = path.join(localesDir, `${L}.ts`);
  const o = extractStrings(fp);
  const keys = Object.keys(o);
  const missing = enKeys.filter((k) => !(k in o));
  const sameAsEn = enKeys.filter((k) => k in o && o[k] === en[k] && String(en[k]).length > 0);
  const empty = keys.filter((k) => !o[k] || String(o[k]).trim() === "");
  const dup = duplicates(keys);
  rows.push({
    lang: L,
    keys: keys.length,
    missing: missing.length,
    sameAsEn: sameAsEn.length,
    empty: empty.length,
    dupKeys: dup.length,
  });
  if (process.argv.includes("--verbose") && (missing.length > 0 || dup.length > 0)) {
    console.log(`\n--- ${L} ---`);
    if (missing.length) console.log("missing sample:", missing.slice(0, 25).join(", "));
    if (dup.length) console.log("duplicates:", dup.join(", "));
  }
}
console.table(rows);

const langArg = process.argv.find((a) => a.startsWith("--missing="));
if (langArg) {
  const L = langArg.split("=")[1];
  const fp = path.join(localesDir, `${L}.ts`);
  const o = extractStrings(fp);
  const missing = enKeys.filter((k) => !(k in o));
  console.log(`\nMissing in ${L} (${missing.length}):`, missing.join(", "));
  const sameAsEn = enKeys.filter((k) => k in o && o[k] === en[k] && String(en[k]).length > 0);
  console.log(`Same as EN in ${L} (${sameAsEn.length}):`, sameAsEn.slice(0, 80).join(", "), sameAsEn.length > 80 ? "…" : "");
}
