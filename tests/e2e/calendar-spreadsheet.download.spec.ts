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
  const firstCategory = exportDialog
    .getByRole("checkbox", { name: /^Selecionar categoria / })
    .first();
  await expect(firstCategory).toBeEnabled();
  await expect(firstCategory).toBeChecked();
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

test("rejeita um arquivo XLSX invalido sem sair do dialogo", async ({ page }) => {
  const dialog = await openSpreadsheetDialog(page);

  await dialog.locator('input[type="file"]').setInputFiles({
    name: "invalido.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("nao e um arquivo zip"),
  });

  await expect(dialog).toContainText(
    "O arquivo .xlsx esta corrompido ou fora do formato esperado."
  );
});
