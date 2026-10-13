import { expect, type Page } from "@playwright/test";

export const creds = {
  worker: { email: process.env.E2E_WORKER_EMAIL ?? "", password: process.env.E2E_WORKER_PASSWORD ?? "" },
  admin: { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" },
};

/** Entra por /login y espera a estar dentro de la app (no en la portada ni en el login). */
export async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(who.email);
  await page.locator('input[type="password"]').fill(who.password);
  await page.locator('input[type="password"]').press("Tab");
  await page.getByRole("button", { name: /iniciar sesión|sign in|log in/i }).click();
  // Debe entrar a la primera, sin recargar (fallo corregido el 12-oct).
  await expect(page.locator('a[href="/logout"]').first()).toBeVisible({ timeout: 20_000 });
}

/** Abre el menú en móvil (en escritorio la barra lateral ya está visible). */
export async function openMenu(page: Page) {
  const burger = page.locator('button[aria-controls="app-mobile-drawer"]');
  if (await burger.isVisible()) await burger.click();
}

export async function logout(page: Page) {
  await page.locator('a[href="/logout"]').first().click();
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  // Al volver a "/" no debe meter otra vez en la app.
  await page.goto("/");
  await expect(page.locator('a[href="/logout"]')).toHaveCount(0);
}
