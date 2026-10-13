import { expect, test } from "@playwright/test";
import { creds, login, logout, openMenu } from "./helpers";

test.describe("admin", () => {
  test.skip(!creds.admin.email || !creds.admin.password, "Faltan E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD");

  test("entra, ve los módulos de su plan y sale", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page, creds.admin);
    await expect(page.getByText(/Something went wrong|Minified React error/i)).toHaveCount(0);
    await openMenu(page);
    await expect(page.locator("#schedule-nav-item").first()).toBeVisible();
    await expect(page.locator("#settings-nav-item").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
    await logout(page);
  });

  test("la pre-nómina no muestra impuestos inventados", async ({ page }) => {
    await login(page, creds.admin);
    await openMenu(page);
    await page.locator("#schedule-nav-item").first().click();
    const tab = page.getByRole("button", { name: /Pre-nómina|Pre-payroll/i }).first();
    test.skip((await tab.count()) === 0, "La pestaña de pre-nómina no está disponible");
    await tab.click();
    await expect(page.getByText(/Impuestos y cotizaciones los calcula tu proveedor|Taxes and contributions are calculated by your provider/i)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /^Neto$|^Net$/ })).toHaveCount(0);
  });
});
