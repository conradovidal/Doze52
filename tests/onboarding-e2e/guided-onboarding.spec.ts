import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("configura Pessoal e ensina uma data e um período no calendário", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  await page.goto(mobile ? "/?mobileUi=1" : "/?mobileUi=0");
  await expect(page).toHaveTitle("Doze 52 | Seu ano em uma página");

  const panel = page.getByRole("region", { name: "Guia inicial do Doze52" });
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "context_selection"
  );
  await expect(panel).toContainText("Onde uma visão do ano inteiro");
  await panel.getByRole("button", { name: /Pessoal/ }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_instruction"
  );

  if (mobile) {
    await page
      .getByRole("button", { name: "Selecionar 2026-08-10 para o onboarding" })
      .click({ force: true });
  } else {
    await page.locator('[data-day-cell][data-day-iso="2026-08-10"]').click();
  }

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_details"
  );
  await panel.getByLabel("Nome da data").fill("Aniversário da mãe");
  await panel.getByRole("button", { name: "Salvar no meu ano" }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "period_instruction"
  );
  await expect(page.locator("[data-calendar-event-id]")).not.toHaveCount(0);

  if (mobile) {
    await page
      .getByRole("button", { name: "Selecionar 2026-08-15 para o onboarding" })
      .click({ force: true });
    await page
      .getByRole("button", { name: "Selecionar 2026-08-22 para o onboarding" })
      .click({ force: true });
  } else {
    const start = page.locator('[data-day-cell][data-day-iso="2026-08-15"]');
    const end = page.locator('[data-day-cell][data-day-iso="2026-08-22"]');
    const startBox = await start.boundingBox();
    const endBox = await end.boundingBox();
    if (!startBox || !endBox) throw new Error("Datas não renderizadas");
    await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 8 });
    await page.mouse.up();
  }

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "period_details"
  );
  await panel.getByLabel("Nome do período").fill("Férias em família");
  await panel.getByRole("button", { name: "Salvar no meu ano" }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "use_case_preview"
  );
  await expect(panel.getByLabel("Prévia de um ano preenchido")).toBeVisible();
  await panel.getByRole("button", { name: /Voltar para o meu ano/ }).click();
  await expect(panel).toHaveAttribute("data-guided-onboarding-step", "save");
  await panel
    .getByRole("button", { name: "Continuar neste dispositivo" })
    .click();
  await expect(panel).toBeHidden();

  const stored = await page.evaluate(() => ({
    onboarding: JSON.parse(
      window.localStorage.getItem("doze52:onboarding:v2") ?? "null"
    ) as { version?: number; step?: string; context?: string } | null,
    store: JSON.parse(window.localStorage.getItem("yiv-store") ?? "null") as {
      state?: {
        profiles?: Array<{ name: string }>;
        categories?: Array<{ name: string }>;
        events?: unknown[];
      };
    } | null,
  }));

  expect(stored.onboarding).toMatchObject({
    version: 3,
    step: "completed",
    context: "personal",
  });
  expect(stored.store?.state?.profiles?.[0]?.name).toBe("Pessoal");
  expect(stored.store?.state?.categories?.slice(0, 3).map((item) => item.name)).toEqual([
    "Aniversários",
    "Férias e viagens",
    "Eventos",
  ]);
  expect(stored.store?.state?.events).toHaveLength(2);
});

test("configura Trabalho com Entregas, Projetos e Reuniões", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Coberto no fluxo desktop");
  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", { name: "Guia inicial do Doze52" });
  await panel.getByRole("button", { name: /Trabalho/ }).click();
  await expect(panel).toHaveAttribute("data-guided-onboarding-step", "date_instruction");
  await expect(panel).toContainText("última entrega importante");

  const configured = await page.evaluate(() => {
    const store = JSON.parse(window.localStorage.getItem("yiv-store") ?? "null") as {
      state?: { profiles?: Array<{ name: string }>; categories?: Array<{ name: string }> };
    } | null;
    return store?.state;
  });
  expect(configured?.profiles?.[0]?.name).toBe("Trabalho");
  expect(configured?.categories?.slice(0, 3).map((item) => item.name)).toEqual([
    "Entregas",
    "Projetos",
    "Reuniões",
  ]);
});

test("Outro pede um nome e cria categorias neutras", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Coberto no fluxo desktop");
  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", { name: "Guia inicial do Doze52" });
  await panel.getByRole("button", { name: /Outro/ }).click();
  await expect(panel).toHaveAttribute("data-guided-onboarding-step", "custom_profile");
  await panel.getByLabel("Nome do perfil").fill("Estudos");
  await panel.getByRole("button", { name: /Continuar/ }).click();

  const configured = await page.evaluate(() => {
    const store = JSON.parse(window.localStorage.getItem("yiv-store") ?? "null") as {
      state?: { profiles?: Array<{ name: string }>; categories?: Array<{ name: string }> };
    } | null;
    return store?.state;
  });
  expect(configured?.profiles?.[0]?.name).toBe("Estudos");
  expect(configured?.categories?.slice(0, 3).map((item) => item.name)).toEqual([
    "Datas importantes",
    "Períodos importantes",
    "Outros",
  ]);
});
