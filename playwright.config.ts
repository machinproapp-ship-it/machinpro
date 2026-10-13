import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de extremo a extremo contra la app publicada (por defecto https://www.machin.pro).
 * Las cuentas de prueba van en variables de entorno (en GitHub: Settings → Secrets → Actions):
 *   E2E_WORKER_EMAIL / E2E_WORKER_PASSWORD   → un trabajador de la empresa de pruebas
 *   E2E_ADMIN_EMAIL  / E2E_ADMIN_PASSWORD    → el admin de la empresa de pruebas
 * Sin esas variables, las pruebas se saltan (no fallan).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://www.machin.pro",
    locale: "es-ES",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "movil", use: { ...devices["Pixel 7"] } },
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
  ],
});
