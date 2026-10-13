import { expect, test } from "@playwright/test";

test("portada, login y salida responden sin errores", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Iniciar sesión|Log in|Sign in/i }).first()).toBeVisible();
  await page.goto("/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.goto("/logout");
  await expect(page).toHaveURL(/\/login/);
  expect(errors, errors.join("\n")).toEqual([]);
});
