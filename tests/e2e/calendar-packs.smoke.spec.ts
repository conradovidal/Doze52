import { expect, test } from "@playwright/test";

import {
  closeEditWorkspace,
  createCustomCategory,
  dismissOnboardingIfVisible,
  expectAuthenticated,
  installVercelBypass,
  observeRuntimeIssues,
  openQaApp,
  openReadyCalendars,
  showCategories,
  waitForSyncReady,
  waitForSupabaseWrite,
} from "./support/browser";

test("contexto, sincronizacao e calendario pronto funcionam de ponta a ponta", async ({
  page,
}) => {
  await installVercelBypass(page);
  const runtime = observeRuntimeIssues(page);
  // Nome único por execução: a conta de QA guarda as categorias de rodadas
  // anteriores, e um nome fixo apareceria em duplicata.
  const categoryName = `QA Smoke ${Date.now()}`;

  await openQaApp(page);
  await expect(page).toHaveTitle("Doze 52 | Seu ano em uma página");
  await expectAuthenticated(page);
  await dismissOnboardingIfVisible(page);

  await createCustomCategory(page, categoryName);

  await openQaApp(page);
  await expectAuthenticated(page);
  await showCategories(page);
  await expect(page.getByRole("button", { name: categoryName, exact: true })).toBeVisible();

  const calendarsDialog = await openReadyCalendars(page);
  await expect(
    calendarsDialog.getByRole("combobox", { name: /Estado para/ })
  ).toContainText("São Paulo (SP)");
  await expect(
    calendarsDialog.getByRole("combobox", { name: /Time para/ })
  ).toContainText("Grêmio");
  const teamCard = calendarsDialog
    .getByRole("article")
    .filter({ has: page.getByRole("combobox", { name: /Time para/ }) });
  const eventsImported = waitForSupabaseWrite(page, "events", ["POST"]);
  await teamCard.getByRole("button", { name: "Adicionar", exact: true }).click();
  // Importado o calendário, o fluxo volta para o painel Editar.
  await closeEditWorkspace(page);

  await expect(page.getByRole("button", { name: "Grêmio 5 x 3 Botafogo" })).toBeVisible();
  await eventsImported;
  await waitForSyncReady(page);
  await openQaApp(page);
  await expectAuthenticated(page);
  await showCategories(page);
  await expect(page.getByText("Jogos do Grêmio", { exact: true })).toBeVisible();
  const managedEvent = page.getByRole("button", { name: "Grêmio 5 x 3 Botafogo" });
  await expect(managedEvent).toBeVisible();
  await managedEvent.click();

  const eventDetails = page.getByRole("dialog", { name: "Detalhes do evento" });
  await expect(eventDetails.getByLabel("Título do evento")).toBeDisabled();
  await expect(eventDetails.getByRole("button", { name: /^Data:/ })).toBeDisabled();
  await expect(eventDetails.getByRole("button", { name: "Fechar" })).toBeVisible();
  await expect(eventDetails.getByRole("button", { name: "Excluir" })).toHaveCount(0);
  await expect(eventDetails.getByRole("button", { name: "Salvar" })).toHaveCount(0);
  await eventDetails.getByRole("button", { name: "Fechar" }).click();

  await page.locator('[data-day-cell][data-day-iso="2026-12-31"]').click();
  const newEventDialog = page.getByRole("dialog", { name: "Novo evento" });
  const eventComboboxes = newEventDialog.getByRole("combobox");
  await expect(eventComboboxes).toHaveCount(3);
  await eventComboboxes.nth(1).click();
  await expect(page.getByRole("option", { name: "Jogos do Grêmio" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await newEventDialog.getByLabel("Título do evento").fill("QA pessoal");
  const personalEventSaved = waitForSupabaseWrite(page, "events", ["POST"]);
  await newEventDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(newEventDialog).toBeHidden();
  await personalEventSaved;
  await waitForSyncReady(page);

  await page.getByRole("button", { name: "QA pessoal" }).click();
  const personalEventDialog = page.getByRole("dialog", { name: "Editar evento" });
  const editComboboxes = personalEventDialog.getByRole("combobox");
  await editComboboxes.nth(1).click();
  await expect(page.getByRole("option", { name: "Jogos do Grêmio" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await personalEventDialog.getByRole("button", { name: "Close" }).click();

  const removeDialog = await openReadyCalendars(page);
  const removeCard = removeDialog
    .getByRole("article")
    .filter({ has: page.getByRole("combobox", { name: /Time para/ }) });
  const eventsRemoved = waitForSupabaseWrite(page, "events", ["DELETE"]);
  await removeCard.getByRole("button", { name: /^Remover/ }).click();
  await eventsRemoved;
  await expect(
    removeCard.getByRole("combobox", { name: /Time para/ })
  ).toContainText("Grêmio");
  await expect(
    removeCard.getByRole("button", { name: "Adicionar", exact: true })
  ).toBeEnabled();
  // Escape sai do catálogo e volta para o painel Editar, que fecha em seguida.
  await page.keyboard.press("Escape");
  await closeEditWorkspace(page);
  await expect(page.getByText("Jogos do Grêmio", { exact: true })).toHaveCount(0);
  await waitForSyncReady(page);

  runtime.assertClean();
});
