import { expect, test } from "@playwright/test";
import { creds, login, logout, openMenu } from "./helpers";

test.describe("trabajador", () => {
  test.skip(!creds.worker.email || !creds.worker.password, "Faltan E2E_WORKER_EMAIL / E2E_WORKER_PASSWORD");

  test("entra a la primera, ve su semana y no ve módulos de empresa", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await login(page, creds.worker);

    // Nunca aparece como administrador ni con la app rota.
    await expect(page.getByText(/Something went wrong|Minified React error/i)).toHaveCount(0);
    await expect(page.getByText(/^Administrador$/)).toHaveCount(0);

    // Lo primero: su semana.
    await expect(page.getByText(/Mi semana|My week/i).first()).toBeVisible({ timeout: 20_000 });

    // Menú: sin Operaciones ni Logística (salvo que el admin le dé esos permisos).
    await openMenu(page);
    await expect(page.locator("#schedule-nav-item").first()).toBeVisible();
    await expect(page.locator("#operations-nav-item")).toHaveCount(0);
    await expect(page.locator("#logistics-nav-item")).toHaveCount(0);

    expect(errors, errors.join("\n")).toEqual([]);
    await logout(page);
  });

  test("abre el día de un turno y ve la obra", async ({ page }) => {
    await login(page, creds.worker);
    const day = page.getByRole("button", { name: /→/ }).filter({ hasText: /\d{2}:\d{2}/ }).first();
    test.skip((await day.count()) === 0, "Sin turnos esta semana para el trabajador de pruebas");
    await day.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/Mi jornada|My shift/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("fichar entrada y salida (solo si E2E_WRITE=1, en la empresa de pruebas)", async ({ page }) => {
    test.skip(process.env.E2E_WRITE !== "1", "Escritura desactivada");
    await login(page, creds.worker);
    const clockOut = page.getByRole("button", { name: /Terminar jornada|Clock out/i }).first();
    const clockIn = page.getByRole("button", { name: /Fichar entrada|Clock in/i }).first();
    if (await clockIn.isVisible()) {
      await clockIn.click();
      await page.getByRole("button", { name: /Fichar entrada|Clock in|Empezar/i }).last().click();
    }
    await expect(clockOut).toBeVisible({ timeout: 20_000 });
    await clockOut.click();
    await expect(page.getByText(/Salida registrada|Clock-out recorded/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
