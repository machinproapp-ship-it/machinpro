import { test as setup } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { creds, login } from "./helpers";

/**
 * Entra una sola vez por rol y guarda la sesión para el resto de pruebas.
 * (Supabase limita los inicios de sesión por IP: entrar en cada prueba los agota.)
 */
const EMPTY = JSON.stringify({ cookies: [], origins: [] });

for (const role of ["worker", "admin"] as const) {
  setup(`sesión ${role}`, async ({ page }) => {
    setup.setTimeout(240_000);
    mkdirSync("tests/e2e/.auth", { recursive: true });
    const file = `tests/e2e/.auth/${role}.json`;
    if (!creds[role].email || !creds[role].password) {
      writeFileSync(file, EMPTY);
      return;
    }
    // Desde GitHub, Supabase a veces tarda en contestar: hasta 3 intentos.
    let lastErr: unknown = null;
    for (let i = 0; i < 3; i++) {
      try {
        await login(page, creds[role]);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await page.waitForTimeout(5000);
      }
    }
    if (lastErr) throw lastErr;
    await page.context().storageState({ path: file });
  });
}
