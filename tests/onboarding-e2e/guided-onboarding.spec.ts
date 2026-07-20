import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("doze52:onboarding:e2e-ready")) return;
    window.localStorage.clear();
    window.sessionStorage.setItem("doze52:onboarding:e2e-ready", "1");
  });
});

test("leva do primeiro item até a visão salva sem bloquear etapas", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  await page.goto(mobile ? "/?mobileUi=1" : "/?mobileUi=0");
  await expect(page).toHaveTitle("Doze 52 | Seu ano em uma página");

  const panel = page.getByRole("region", { name: "Guia inicial do Doze52" });
  await expect(panel).toHaveAttribute("data-guided-onboarding-step", "intro");
  await expect(panel).toContainText("O Doze52 mostra o ano inteiro");

  await panel.getByRole("button", { name: "Adicionar algo importante" }).click();
  const firstDialog = page.getByRole("dialog", { name: "Algo que já importa" });
  await expect(firstDialog).toBeVisible();
  await firstDialog.getByLabel("Título do evento").fill("Viagem em família");
  await firstDialog.getByLabel("Data de início").fill("2026-08-10");
  await firstDialog.getByLabel("Data final").fill("2026-08-10");
  await expect(firstDialog.getByText("Organização e detalhes")).toBeVisible();
  await expect(firstDialog.getByText("Perfil", { exact: true })).toBeHidden();
  await firstDialog.getByRole("button", { name: "Salvar" }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "period_prompt"
  );
  await expect(page.locator("[data-calendar-event-id]")).not.toHaveCount(0);
  await panel.getByRole("button", { name: "Fechar ajuda por agora" }).click();
  await expect(panel).toBeHidden();

  await page.reload();
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "period_prompt"
  );
  await panel.getByRole("button", { name: "Adicionar um período" }).click();

  const periodDialog = page.getByRole("dialog", { name: "Adicionar um período" });
  await periodDialog.getByLabel("Título do evento").fill("Curso de especialização");
  await periodDialog.getByLabel("Data de início").fill("2026-09-01");
  await periodDialog.getByLabel("Data final").fill("2026-10-15");
  await periodDialog.getByRole("button", { name: "Salvar" }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "context_prompt"
  );
  await panel.getByRole("button", { name: "Ver meu ano" }).click();
  await expect(panel).toHaveAttribute("data-guided-onboarding-step", "reflection");
  await panel
    .getByRole("button", { name: "Algo importante ainda está sem espaço." })
    .click();
  await panel.getByRole("button", { name: "Continuar usando" }).click();

  await expect(panel).toHaveAttribute("data-guided-onboarding-step", "save");
  await panel.getByRole("button", { name: "Criar minha conta" }).click();
  const authDialog = page.getByRole("dialog", { name: "Criar conta" });
  await expect(authDialog).toBeVisible();
  await authDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(panel).toHaveAttribute("data-guided-onboarding-step", "save");
  await panel
    .getByRole("button", { name: "Continuar neste dispositivo" })
    .click();
  await expect(panel).toBeHidden();
  await expect(page.getByText("Teu ano já começou a ganhar forma")).toBeVisible();

  const stored = await page.evaluate(() => ({
    onboarding: JSON.parse(
      window.localStorage.getItem("doze52:onboarding:v2") ?? "null"
    ) as { step?: string; reflection?: string } | null,
    store: JSON.parse(window.localStorage.getItem("yiv-store") ?? "null") as {
      state?: { profiles?: Array<{ name: string }>; events?: unknown[] };
    } | null,
  }));

  expect(stored.onboarding).toMatchObject({
    step: "completed",
    reflection: "missing_priority",
  });
  expect(stored.store?.state?.profiles?.[0]?.name).toBe("Meu ano");
  expect(stored.store?.state?.events).toHaveLength(2);
});
