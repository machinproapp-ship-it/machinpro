import fs from "fs";
import path from "path";

const re = /dark:([a-zA-Z0-9_[\].%+\-/:(),]+)/g;
const set = new Set();

const extra = `
dark:divide-gray-700 dark:shadow-lg dark:from-gray-800 dark:to-gray-900
dark:bg-opacity-50 dark:bg-opacity-75 dark:bg-opacity-90
`.trim().split(/\s+/);
for (const c of extra) if (c) set.add(c);

function walk(dir) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory() && !n.name.startsWith(".") && n.name !== "node_modules") walk(p);
    else if (/\.(tsx|ts|jsx|js)$/.test(n.name)) {
      const s = fs.readFileSync(p, "utf8");
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(s))) set.add(`dark:${m[1]}`);
    }
  }
}

walk("src");

const sorted = [...set].sort();
const className = sorted.join(" ");

const out = `/**
 * Nunca renderizar. Solo literales \`dark:*\` para que Tailwind los incluya en producción.
 * Generado/actualizado con: node scripts/generate-dark-safelist.mjs
 */
export function DarkTailwindSafelist() {
  return (
    <div
      className={${JSON.stringify(className)}}
      hidden
      aria-hidden
    />
  );
}
`;

fs.mkdirSync("src/styles", { recursive: true });
fs.writeFileSync("src/styles/dark-safelist.tsx", out, "utf8");
console.log("wrote src/styles/dark-safelist.tsx", sorted.length, "classes");
