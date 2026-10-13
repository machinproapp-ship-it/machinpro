import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guardia contra el fallo que rompió la app el 12-oct (React #310): en la página principal
 * ningún hook puede ir después del primer "return" anticipado (pantalla de carga / login).
 */
describe("página principal", () => {
  it("no hay hooks después del primer return anticipado", () => {
    const src = readFileSync(path.resolve(__dirname, "../../src/app/page.tsx"), "utf8");
    const home = src.indexOf("export default function Home()");
    expect(home).toBeGreaterThan(0);
    const firstReturn = src.indexOf("\n  if (authLoading) {", home);
    expect(firstReturn).toBeGreaterThan(home);
    const after = src.slice(firstReturn);
    const offenders = after
      .split("\n")
      .filter((l) => /^\s{2}(const|let)\s.*\buse(State|Memo|Effect|Callback|Ref|LayoutEffect)\(/.test(l) || /^\s{2}use(Effect|LayoutEffect)\(/.test(l));
    expect(offenders).toEqual([]);
  });
});
