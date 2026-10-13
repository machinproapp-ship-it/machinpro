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
    mkdirSync("tests/e2e/.auth", { recursive: true });
    const file = `tests/e2e/.auth/${role}.json`;
    if (!creds[role].email || !creds[role].password) {
      writeFileSync(file, EMPTY);
      return;
    }
    await login(page, creds[role]);
    await page.context().storageState({ path: file });
  });
}
