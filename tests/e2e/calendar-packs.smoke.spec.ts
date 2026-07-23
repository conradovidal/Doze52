import { expect, test } from "@playwright/test";

import {
  dismissOnboardingIfVisible,
  expectAuthenticated,
  installVercelBypass,
  observeRuntimeIssues,
  openQaApp,
  waitForSyncReady,
  waitForSupabaseWrite,
} from "./support/browser";

test("contexto, sincronizacao e calendario pronto funcionam de ponta a ponta", async ({
  page,
}) => {
  await installVercelBypass(page);
  const runtime = observeRuntimeIssues(page);

  await openQaApp(page);
  await expect(page).toHaveTitle("Doze 52 | Seu ano em uma página");
  await expectAuthenticated(page);
  await dismissOnboardingIfVisible(page);

  await page.getByRole("button", { name: "Editar contextos e categorias" }).click();
  await page.getByRole("button", { name: "Criar novo contexto" }).click();
  const profileDialog = page.getByRole("dialog", { name: "Novo contexto" });
  await profileDialog.getByLabel("Nome do contexto").fill("QA Smoke");
  const profileSaved = waitForSupabaseWrite(page, "calendar_profiles", ["POST"]);
  await profileDialog.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(profileDialog).toBeHidden();
  await page
    .getByRole("button", { name: "Finalizar edição de contextos e categorias" })
    .click();
  await profileSaved;
  await waitForSyncReady(page);

  await openQaApp(page);
  await expectAuthenticated(page);
  await expect(page.getByRole("button", { name: "QA Smoke", exact: true })).toBeVisible();

  await page
    .getByRole("button", {
      name: "Adicionar ou gerenciar calendários. Novos calendários disponíveis.",
    })
    .click();
  const calendarsDialog = page.getByRole("dialog", { name: "Calendários" });
  const teamCard = calendarsDialog
    .getByRole("article")
    .filter({ hasText: "Jogos do seu time favorito" });
  await teamCard.getByRole("button", { name: "Adicionar calendário" }).click();
  await teamCard.getByRole("combobox", { name: "Contexto para Jogos do seu time favorito" }).click();
  await page.getByRole("option", { name: "QA Smoke" }).click();
  const eventsImported = waitForSupabaseWrite(page, "events", ["POST"]);
  await teamCard
    .getByRole("button", {
      name: "Adicionar calendário Jogos do seu time favorito ao contexto QA Smoke",
    })
    .click();
  await expect(teamCard.getByRole("button", { name: "Remover" })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "Grêmio 5 x 0 São Luiz" })).toBeVisible();
  await eventsImported;
  await waitForSyncReady(page);
  await openQaApp(page);
  await expectAuthenticated(page);
  await expect(page.getByText("Jogos do Grêmio", { exact: true })).toBeVisible();
  const managedEvent = page.getByRole("button", { name: "Grêmio 5 x 0 São Luiz" });
  await expect(managedEvent).toBeVisible();
  await managedEvent.click();

  const eventDetails = page.getByRole("dialog", { name: "Detalhes do evento" });
  await expect(eventDetails.getByLabel("Título do evento")).toBeDisabled();
  await expect(eventDetails.getByLabel("Data de início")).toBeDisabled();
  await expect(eventDetails.getByRole("button", { name: "Fechar" })).toBeVisible();
  await expect(eventDetails.getByRole("button", { name: "Excluir" })).toHaveCount(0);
  await expect(eventDetails.getByRole("button", { name: "Salvar" })).toHaveCount(0);
  await eventDetails.getByRole("button", { name: "Fechar" }).click();

  await page.locator('[data-day-cell][data-day-iso="2026-12-31"]').click();
  const newEventDialog = page.getByRole("dialog", { name: "Novo evento" });
  const eventComboboxes = newEventDialog.getByRole("combobox");
  await expect(eventComboboxes).toHaveCount(3);
  await eventComboboxes.nth(0).click();
  await expect(page.getByRole("option", { name: "QA Smoke" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await eventComboboxes.nth(1).click();
  await expect(page.getByRole("option", { name: "Jogos do Grêmio" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await newEventDialog.getByLabel("Título do evento").fill("QA pessoal");
  const personalEventSaved = waitForSupabaseWrite(page, "events", ["POST"]);
  await newEventDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(newEventDialog).toBeHidden();
  await personalEventSaved;
  await waitForSyncReady(page);

  await page.getByRole("button", { name: "Pessoal", exact: true }).click();
  await page.getByRole("button", { name: "QA pessoal" }).click();
  const personalEventDialog = page.getByRole("dialog", { name: "Editar evento" });
  const editComboboxes = personalEventDialog.getByRole("combobox");
  await editComboboxes.nth(0).click();
  await expect(page.getByRole("option", { name: "QA Smoke" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await editComboboxes.nth(1).click();
  await expect(page.getByRole("option", { name: "Jogos do Grêmio" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await personalEventDialog.getByRole("button", { name: "Close" }).click();

  await page
    .getByRole("button", {
      name: "Adicionar ou gerenciar calendários. Novos calendários disponíveis.",
    })
    .click();
  const removeCard = page
    .getByRole("dialog", { name: "Calendários" })
    .getByRole("article")
    .filter({ hasText: "Jogos do seu time favorito" });
  const eventsRemoved = waitForSupabaseWrite(page, "events", ["DELETE"]);
  await removeCard.getByRole("button", { name: "Remover" }).click();
  await expect(removeCard.getByRole("button", { name: "Adicionar calendário" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Jogos do Grêmio", { exact: true })).toHaveCount(0);
  await eventsRemoved;
  await waitForSyncReady(page);

  runtime.assertClean();
});
