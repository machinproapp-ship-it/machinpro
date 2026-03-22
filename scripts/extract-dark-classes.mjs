import fs from "fs";
import path from "path";

const re = /dark:([a-zA-Z0-9_[\].%+\-/:(),]+)/g;
const set = new Set();

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
console.log(sorted.join(" "));
console.error("count", sorted.length);
