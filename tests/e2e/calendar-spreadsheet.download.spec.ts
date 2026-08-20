import { expect, test } from "@playwright/test";

import {
  dismissOnboardingIfVisible,
  expectAuthenticated,
  installVercelBypass,
  openQaApp,
} from "./support/browser";

const openSpreadsheetDialog = async (page: import("@playwright/test").Page) => {
  await installVercelBypass(page);
  await openQaApp(page);
  await expectAuthenticated(page);
  await dismissOnboardingIfVisible(page);
  await page.getByRole("button", { name: "Abrir menu da conta" }).click();
  await page.getByRole("button", { name: "Importar/exportar Excel" }).click();
  return page.getByRole("dialog", { name: "Importar e exportar com Excel" });
};

test("baixa o template e exporta o recorte selecionado", async ({ page }) => {
  const dialog = await openSpreadsheetDialog(page);

  const templateDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Baixar template" }).click();
  const templateDownload = await templateDownloadPromise;
  expect(templateDownload.suggestedFilename()).toBe("doze52-template-eventos.xlsx");

  await dialog.getByRole("button", { name: "Exportar calendario" }).click();
  const exportDialog = page.getByRole("dialog", { name: "Selecionar dados para exportar" });
  const enabledCategories = exportDialog
    .getByRole("checkbox", { name: /^Selecionar categoria / })
    .locator(":enabled");
  await expect(enabledCategories.first()).toBeChecked();

  const firstCategory = enabledCategories.first();
  await firstCategory.uncheck();
  await expect(firstCategory).not.toBeChecked();
  await exportDialog.getByRole("button", { name: "Limpar seleção" }).click();
  await expect(
    exportDialog.getByRole("button", { name: /^Exportar \d+ eventos?$/ })
  ).toBeDisabled();

  await exportDialog.getByRole("button", { name: "Selecionar tudo" }).click();
  const exportButton = exportDialog.getByRole("button", {
    name: /^Exportar \d+ eventos?$/,
  });
  await expect(exportButton).toBeEnabled();
  const exportDownloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const exportDownload = await exportDownloadPromise;
  expect(exportDownload.suggestedFilename()).toMatch(
    /^doze52-calendario-\d{4}-\d{2}-\d{2}\.xlsx$/
  );
});
