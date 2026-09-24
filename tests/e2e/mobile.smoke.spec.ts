import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  installVercelBypass,
  openAuthenticatedSettings,
  openQaApp,
} from "./support/browser";

test("modal de calendarios permanece alinhado no mobile", async ({ page }) => {
  await installVercelBypass(page);
  await openQaApp(page);
  await expectAuthenticated(page);
  await page
    .getByRole("button", {
      name: "Adicionar ou gerenciar calendários.",
    })
    .click();

  const dialog = page.getByRole("dialog", { name: "Calendários" });
  const cards = dialog.getByRole("article");
  await expect(cards).toHaveCount(4);
  await expect(cards.getByRole("heading")).toHaveText([
    "Feriados",
    "Jogos do seu time",
    "Copa do Mundo 2026",
    "Corridas F1",
  ]);

  const selectorBoxes = await Promise.all(
    [0, 1, 2].map(async (index) => {
      const box = await cards.nth(index).getByRole("combobox").boundingBox();
      if (!box) throw new Error(`Seletor ${index + 1} nao esta visivel no mobile.`);
      return box;
    })
  );
  const firstX = selectorBoxes[0].x;
  for (const box of selectorBoxes) expect(Math.abs(box.x - firstX)).toBeLessThanOrEqual(1);

  const viewport = page.viewportSize();
  const dialogBox = await dialog.boundingBox();
  if (!viewport || !dialogBox) throw new Error("Nao foi possivel medir o modal mobile.");
  expect(dialogBox.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
});

test("exportacao permanece utilizavel no mobile", async ({ page }) => {
  await installVercelBypass(page);
  await openQaApp(page);
  await expectAuthenticated(page);
  const dialog = await openAuthenticatedSettings(page, "data");
  const templateDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /^Baixar template/ }).click();
  expect((await templateDownloadPromise).suggestedFilename()).toBe(
    "doze52-template-eventos.xlsx"
  );

  await dialog.getByRole("button", { name: /^Exportar calendário/ }).click();
  // A seleção abre dentro do próprio painel, no lugar da tela inicial.
  await expect(dialog.getByText("Selecionar dados para exportar")).toBeVisible();
  const exportDialog = dialog;
  await expect(exportDialog.getByRole("button", { name: "Limpar seleção" })).toBeEnabled();

  const viewport = page.viewportSize();
  const dialogBox = await exportDialog.boundingBox();
  if (!viewport || !dialogBox) throw new Error("Nao foi possivel medir o modal de exportacao.");
  expect(dialogBox.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
});
