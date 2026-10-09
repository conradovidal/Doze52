import { expect, test } from "@playwright/test";

import {
  createCustomCategoryMobile,
  dismissOnboardingIfVisible,
  expectAuthenticated,
  installVercelBypass,
  openAuthenticatedSettings,
  openQaApp,
  waitForSyncReady,
} from "./support/browser";

test("modal de calendarios permanece alinhado no mobile", async ({ page }) => {
  await installVercelBypass(page);
  await openQaApp(page);
  await expectAuthenticated(page);
  // No mobile "Editar" liga a edição inline (sem o painel do desktop): a
  // categoria nova parte direto do "+" e o catálogo é uma das duas opções.
  await page.getByRole("button", { name: "Editar", exact: true }).first().click();
  await page.getByRole("button", { name: "Criar nova categoria" }).click();
  await page.getByRole("button", { name: /^Adicionar calendário pronto/ }).click();

  const dialog = page.getByRole("dialog", { name: "Calendários" });
  const cards = dialog.getByRole("article");
  await expect(cards).toHaveCount(4);
  await expect(cards.getByRole("heading")).toHaveText([
    "Feriados nacionais + estaduais",
    "Jogos do Grêmio",
    "Copa do Mundo de 2026",
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

test("sem rede avisa que os dados ficam no aparelho e volta a sincronizar sozinho", { tag: "@mobile" }, async ({
  page,
  context,
}) => {
  await installVercelBypass(page);
  await openQaApp(page);
  await expectAuthenticated(page);

  await context.setOffline(true);
  const notice = page.getByText("Sem conexão", { exact: true });
  await expect(notice).toBeVisible();
  await expect(
    page.getByText("Suas alterações ficam neste aparelho e sincronizam quando a internet voltar.")
  ).toBeVisible();

  await context.setOffline(false);
  await expect(notice).toHaveCount(0);
  await waitForSyncReady(page);
});

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

// Simula o que o Chrome entrega quando o app é instalável.
const dispatchInstallPrompt = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = async () => {
      (window as unknown as { __installPrompted?: boolean }).__installPrompted = true;
    };
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(event);
  });

test("quem já usa o app recebe o convite de instalação uma única vez", { tag: "@mobile" }, async ({
  page,
}) => {
  await installVercelBypass(page);
  await openQaApp(page);
  await expectAuthenticated(page);
  await dismissOnboardingIfVisible(page);
  // O convite espera a pessoa ter montado algo dela.
  await createCustomCategoryMobile(page, `QA Install ${Date.now()}`);

  await dispatchInstallPrompt(page);
  const invite = page.getByRole("status").filter({ hasText: "Instale o Doze 52" });
  await expect(invite).toBeVisible({ timeout: 12_000 });
  await invite.getByRole("button", { name: "Instalar" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __installPrompted?: boolean }).__installPrompted === true
      )
    )
    .toBe(true);

  // Registrado ao mostrar: depois de recarregar não volta (intervalo de 30 dias).
  await openQaApp(page);
  await expectAuthenticated(page);
  await dispatchInstallPrompt(page);
  await page.waitForTimeout(6000);
  await expect(page.getByRole("status").filter({ hasText: "Instale o Doze 52" })).toHaveCount(0);
});

test.describe("iOS", () => {
  test.use({ userAgent: IPHONE_SAFARI });

  test("logado e sincronizado, o perfil ensina a adicionar à tela de início", { tag: "@mobile" }, async ({
    page,
  }) => {
    await installVercelBypass(page);
    await openQaApp(page);
    await expectAuthenticated(page);

    await page.getByRole("button", { name: /Abrir (perfil|conta)/ }).click();
    await page.getByRole("button", { name: /^Instalar app/ }).click();

    const guide = page.getByRole("dialog", { name: "Instalar o Doze 52" });
    await expect(guide).toBeVisible();
    await expect(guide).toContainText("Compartilhar");
    await expect(guide).toContainText("Adicionar à Tela de Início");
    await guide.getByRole("button", { name: "Entendi" }).click();
    await expect(guide).toBeHidden();
  });
});
