import { expect, test, type Page } from "@playwright/test";

import {
  createCustomCategory,
  dismissOnboardingIfVisible,
  expectAuthenticated,
  installVercelBypass,
  openQaApp,
  waitForSupabaseWrite,
  waitForSyncReady,
} from "./support/browser";

// Snapshot que o app guarda quando um salvamento falha e é o que o retry
// reenvia (lib/pending-sync.ts).
const readPendingSnapshot = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((item) =>
      item.startsWith("pending-sync:")
    );
    return key ? window.localStorage.getItem(key) : null;
  });

// O aviso "Sem conexão" é fixo no rodapé e pode cobrir as últimas linhas da
// grade: fecha-se no X antes de clicar na célula, se estiver na tela.
const closeOfflineNotice = async (page: Page) => {
  const notice = page.getByRole("status").filter({ hasText: "Sem conexão" });
  if (await notice.count()) {
    await notice.getByRole("button", { name: "Fechar aviso" }).click();
    await expect(notice).toHaveCount(0);
  }
};

const createEvent = async (page: Page, iso: string, title: string) => {
  await closeOfflineNotice(page);
  await page.locator(`[data-day-cell][data-day-iso="${iso}"]`).click();
  const dialog = page.getByRole("dialog", { name: "Novo evento" });
  await dialog.getByLabel("Título do evento").fill(title);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();
};

test("edições feitas offline, inclusive depois da primeira falha, chegam ao servidor ao reconectar", { tag: "@desktop" }, async ({
  page,
  context,
}) => {
  await installVercelBypass(page);
  await openQaApp(page);
  await expectAuthenticated(page);
  await dismissOnboardingIfVisible(page);

  // Título e dia únicos por execução: a conta de QA guarda os eventos de
  // rodadas anteriores, e um dia já ocupado cobre a célula para o clique.
  const stamp = Date.now();
  const day = String((stamp % 27) + 1).padStart(2, "0");
  const first = { iso: `2026-11-${day}`, title: `Offline A ${stamp}` };
  const second = { iso: `2026-12-${day}`, title: `Offline B ${stamp}` };

  // O diálogo de evento só salva com uma categoria, e a conta de QA começa
  // limpa. Criada ainda online, para o sync já estar em dia ao cair a rede.
  await createCustomCategory(page, `QA Offline ${stamp}`);

  await context.setOffline(true);
  const offlineNotice = page.getByRole("status").filter({ hasText: "Sem conexão" });
  await expect(offlineNotice).toBeVisible();

  // 1ª edição offline: o salvamento falha e o sync fica travado, com o
  // snapshot pendente guardado.
  await createEvent(page, first.iso, first.title);
  await expect.poll(() => readPendingSnapshot(page)).toContain(first.title);

  // 2ª edição, já com o sync travado: antes do conserto do #147 ela só existia
  // no store local e o retry a sobrescrevia com o snapshot da 1ª falha.
  await createEvent(page, second.iso, second.title);
  await expect.poll(() => readPendingSnapshot(page)).toContain(second.title);

  // Ao reconectar o app tenta de novo sozinho, sem ninguém tocar em nada.
  const resent = waitForSupabaseWrite(page, "events");
  await context.setOffline(false);
  await resent;
  await waitForSyncReady(page);
  await expect.poll(() => readPendingSnapshot(page)).toBeNull();

  // Do servidor: recarregar traz as duas edições.
  await openQaApp(page);
  await expectAuthenticated(page);
  await expect(page.getByRole("button", { name: first.title })).toBeVisible();
  await expect(page.getByRole("button", { name: second.title })).toBeVisible();
});
