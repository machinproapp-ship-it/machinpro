import { expect, type Page } from "@playwright/test";

export const creds = {
  worker: { email: process.env.E2E_WORKER_EMAIL ?? "", password: process.env.E2E_WORKER_PASSWORD ?? "" },
  admin: { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" },
};

/** Entra por /login y espera a estar dentro de la app (no en la portada ni en el login). */
export async function login(page: Page, who: { email: string; password: string }) {
  // Navegador limpio: sin la bienvenida de la beta ni el tour, que tapan la pantalla la primera vez.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("machinpro_beta_welcomed", "true");
      localStorage.setItem("machinpro_tour_completed", "true");
    } catch {
      /* ignore */
    }
  });
  const diag: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") diag.push(`console.${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) diag.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().slice(0, 120)}`);
  });
  page.on("requestfailed", (r) => diag.push(`FALLÓ ${r.method()} ${r.url().slice(0, 120)} ${r.failure()?.errorText ?? ""}`));
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("supabase.co") || u.includes("/api/")) diag.push(`→ ${r.method()} ${u.slice(0, 110)}`);
  });
  page.on("requestfinished", async (r) => {
    const u = r.url();
    if (u.includes("supabase.co") || u.includes("/api/")) {
      const res = await r.response().catch(() => null);
      diag.push(`← ${res?.status() ?? "?"} ${u.slice(0, 110)}`);
    }
  });
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) diag.push(`nav → ${f.url()}`);
  });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(who.email);
  await page.locator('input[type="password"]').fill(who.password);
  await page.locator('input[type="password"]').press("Tab");
  await page.getByRole("button", { name: /iniciar sesión|sign in|log in/i }).click();
  // Debe entrar a la primera, sin recargar (fallo corregido el 12-oct).
  try {
    await expect(page.locator('a[href="/logout"]').first()).toBeVisible({ timeout: 30_000 });
  } catch (e) {
    const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 300);
    const locks = await page
      .evaluate(async () => {
        try {
          const q = await (navigator as Navigator & { locks?: { query: () => Promise<unknown> } }).locks?.query();
          return JSON.stringify(q);
        } catch (err) {
          return String(err);
        }
      })
      .catch(() => "");
    diag.push(`locks: ${locks}`);
    throw new Error(
      `No entró en la app. URL: ${page.url()}\nPantalla: ${text}\nDiagnóstico:\n${diag.slice(-40).join("\n")}\n${String(e)}`
    );
  }
}

export const STATE = {
  worker: "tests/e2e/.auth/worker.json",
  admin: "tests/e2e/.auth/admin.json",
};

/** Abre el menú en móvil (en escritorio la barra lateral ya está visible). */
export async function openMenu(page: Page) {
  const burger = page.locator('button[aria-controls="app-mobile-drawer"]');
  if (await burger.isVisible()) await burger.click();
}

/** Entrada del menú visible (en móvil hay una copia oculta de la barra lateral). */
export function navItem(page: Page, id: string) {
  return page.locator(`[id="${id}"]`).locator("visible=true");
}

export async function logout(page: Page) {
  // Cierra el menú del móvil si quedó abierto.
  const closeDrawer = page.locator('#app-mobile-drawer button[aria-label]').first();
  if (await closeDrawer.isVisible().catch(() => false)) await page.keyboard.press("Escape");
  await page.goto("/");
  await page.locator('a[href="/logout"]').locator("visible=true").first().click();
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  // Al volver a "/" no debe meter otra vez en la app.
  await page.goto("/");
  await expect(page.locator('a[href="/logout"]')).toHaveCount(0);
}
