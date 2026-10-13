import { expect, test } from "@playwright/test";
import { STATE, creds, navItem, openMenu } from "./helpers";

test.describe("admin", () => {
  test.skip(!creds.admin.email || !creds.admin.password, "Faltan E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD");
  test.use({ storageState: STATE.admin });

  test("entra y ve los módulos de su plan", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.locator('a[href="/logout"]').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Something went wrong|Minified React error/i)).toHaveCount(0);
    await openMenu(page);
    await expect(navItem(page, "schedule-nav-item").first()).toBeVisible();
    await expect(navItem(page, "settings-nav-item").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("la pre-nómina no muestra impuestos inventados", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href="/logout"]').first()).toBeVisible({ timeout: 30_000 });
    await openMenu(page);
    await navItem(page, "schedule-nav-item").first().click();
    const tab = page.getByRole("button", { name: /Pre-nómina|Pre-payroll/i }).first();
    test.skip((await tab.count()) === 0, "La pestaña de pre-nómina no está disponible");
    await tab.click();
    await expect(
      page.getByText(/Impuestos y cotizaciones los calcula tu proveedor|Taxes and contributions are calculated by your provider/i)
    ).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /^Neto$|^Net$/ })).toHaveCount(0);
  });
});
