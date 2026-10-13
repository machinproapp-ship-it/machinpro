import { expect, test } from "@playwright/test";
import { STATE, creds, login, logout, navItem, openMenu } from "./helpers";

const noCreds = !creds.worker.email || !creds.worker.password;

test.describe("trabajador: entrar y salir", () => {
  test.skip(noCreds, "Faltan E2E_WORKER_EMAIL / E2E_WORKER_PASSWORD");

  test("entra a la primera y sale con el botón", async ({ page }) => {
    await login(page, creds.worker);
    await logout(page);
  });
});

test.describe("trabajador", () => {
  test.skip(noCreds, "Faltan E2E_WORKER_EMAIL / E2E_WORKER_PASSWORD");
  test.use({ storageState: STATE.worker });

  test("ve su semana y no ve módulos de empresa", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.locator('a[href="/logout"]').first()).toBeVisible({ timeout: 30_000 });

    // Nunca aparece como administrador ni con la app rota.
    await expect(page.getByText(/Something went wrong|Minified React error/i)).toHaveCount(0);
    await expect(page.getByText(/^Administrador$/)).toHaveCount(0);

    // Lo primero: su semana.
    await expect(page.getByText(/Mi semana|My week/i).first()).toBeVisible({ timeout: 20_000 });

    // Menú: sin Operaciones ni Logística (salvo que el admin le dé esos permisos).
    await openMenu(page);
    await expect(navItem(page, "schedule-nav-item").first()).toBeVisible();
    await expect(page.locator("#operations-nav-item")).toHaveCount(0);
    await expect(page.locator("#logistics-nav-item")).toHaveCount(0);

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("abre el día de un turno y ve la obra", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Mi semana|My week/i).first()).toBeVisible({ timeout: 30_000 });
    const day = page.getByRole("button", { name: /→/ }).filter({ hasText: /\d{2}:\d{2}/ }).first();
    test.skip((await day.count()) === 0, "Sin turnos esta semana para el trabajador de pruebas");
    await day.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/Mi jornada|My shift/i).first()).toBeVisible();
  });

  test("fichar entrada y salida (solo si E2E_WRITE=1, en la empresa de pruebas)", async ({ page }) => {
    test.skip(process.env.E2E_WRITE !== "1", "Escritura desactivada");
    await page.goto("/");
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
