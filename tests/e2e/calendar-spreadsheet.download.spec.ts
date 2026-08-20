import { expect, test } from "@playwright/test";

import {
  dismissOnboardingIfVisible,
  expectAuthenticated,
  installVercelBypass,
  openQaApp,
  waitForSupabaseWrite,
  waitForSyncReady,
} from "./support/browser";

const createExportableCategory = async (page: import("@playwright/test").Page) => {
  await installVercelBypass(page);
  await openQaApp(page);
  await expectAuthenticated(page);
  await dismissOnboardingIfVisible(page);
  await page.getByRole("button", { name: "Editar contextos e categorias" }).click();
  await page.getByRole("button", { name: "Criar nova categoria" }).click();
  const categoryDialog = page.getByRole("dialog", { name: "Nova categoria" });
  await categoryDialog.getByLabel("Nome da categoria").fill("QA Export");
  const categorySaved = waitForSupabaseWrite(page, "categories", ["POST"]);
  await categoryDialog.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(categoryDialog).toBeHidden();
  await page
    .getByRole("button", { name: "Finalizar edição de contextos e categorias" })
    .click();
  await categorySaved;
  await waitForSyncReady(page);

  await page.locator('[data-day-cell][data-day-iso="2026-12-31"]').click();
  const eventDialog = page.getByRole("dialog", { name: "Novo evento" });
  await eventDialog.getByLabel("Título do evento").fill("QA Export Event");
  const eventSaved = waitForSupabaseWrite(page, "events", ["POST"]);
  await eventDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(eventDialog).toBeHidden();
  await eventSaved;
  await waitForSyncReady(page);
};

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
  await createExportableCategory(page);
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
  await expect(
    exportDialog.getByRole("button", { name: /^Exportar \d+ eventos?$/ })
  ).toBeDisabled();

  await exportDialog.getByRole("button", { name: "Selecionar tudo" }).click();
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
