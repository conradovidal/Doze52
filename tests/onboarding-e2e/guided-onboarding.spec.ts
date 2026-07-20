import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

const selectGuidedDate = async (page: Page, mobile: boolean, dateIso: string) => {
  if (mobile) {
    await page
      .getByRole("button", { name: `Selecionar ${dateIso} para o onboarding` })
      .click({ force: true });
    return;
  }
  await page.locator(`[data-day-cell][data-day-iso="${dateIso}"]`).click();
};

const selectGuidedPeriod = async (
  page: Page,
  mobile: boolean,
  startIso: string,
  endIso: string
) => {
  if (mobile) {
    await selectGuidedDate(page, true, startIso);
    await selectGuidedDate(page, true, endIso);
    return;
  }
  const start = page.locator(`[data-day-cell][data-day-iso="${startIso}"]`);
  const end = page.locator(`[data-day-cell][data-day-iso="${endIso}"]`);
  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  if (!startBox || !endBox) throw new Error("Datas não renderizadas");
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 8 });
  await page.mouse.up();
};

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

  if (!mobile) {
    const contextOptions = await panel
      .getByRole("button", { name: /Pessoal|Trabalho|Outro/ })
      .all();
    const boxes = await Promise.all(contextOptions.map((option) => option.boundingBox()));
    expect(boxes).toHaveLength(3);
    expect(boxes.every(Boolean)).toBe(true);
    expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
    expect(boxes[2]!.y).toBeGreaterThan(boxes[1]!.y);
  }

  await panel.getByRole("button", { name: /Pessoal/ }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "profile_reveal"
  );
  const highlightedProfile = page.locator(
    '[data-onboarding-profile-id][data-onboarding-highlighted="true"]'
  );
  await expect(highlightedProfile.first()).toBeVisible();
  await expect(page.locator("[data-onboarding-connector]")).toBeVisible();

  if (!mobile) {
    const panelBox = await panel.boundingBox();
    const profileBox = await highlightedProfile.first().boundingBox();
    if (!panelBox || !profileBox) throw new Error("Onboarding sem âncoras visíveis");
    const overlaps = !(
      panelBox.x + panelBox.width <= profileBox.x ||
      profileBox.x + profileBox.width <= panelBox.x ||
      panelBox.y + panelBox.height <= profileBox.y ||
      profileBox.y + profileBox.height <= panelBox.y
    );
    expect(overlaps).toBe(false);
  }

  await panel.getByRole("button", { name: "Adicionar datas importantes" }).click();
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_instruction"
  );
  await expect(
    page.locator('[data-onboarding-category-id][data-onboarding-highlighted="true"]').first()
  ).toHaveAttribute("title", "Aniversários");

  await selectGuidedDate(page, mobile, "2026-08-10");

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_details"
  );
  await panel.getByLabel("Nome da data").fill("Aniversário da mãe");
  await panel.getByRole("button", { name: "Salvar no meu ano" }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_instruction"
  );
  await expect(panel).toContainText("mais um aniversário");
  await selectGuidedDate(page, mobile, "2026-09-12");
  await panel.getByLabel("Nome da data").fill("Aniversário do pai");
  await panel.getByRole("button", { name: "Salvar no meu ano" }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "period_instruction"
  );
  await expect(
    page.locator('[data-onboarding-category-id][data-onboarding-highlighted="true"]').first()
  ).toHaveAttribute("title", "Férias e viagens");
  await expect(page.locator("[data-calendar-event-id]")).not.toHaveCount(0);

  await selectGuidedPeriod(page, mobile, "2026-08-15", "2026-08-22");

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "period_details"
  );
  await panel.getByLabel("Nome do período").fill("Férias em família");
  await panel.getByRole("button", { name: "Salvar no meu ano" }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "period_instruction"
  );
  await expect(panel).toContainText("próxima viagem");
  await selectGuidedPeriod(page, mobile, "2026-11-10", "2026-11-20");
  await panel.getByLabel("Nome do período").fill("Próximas férias");
  await panel.getByRole("button", { name: "Salvar no meu ano" }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "use_case_preview"
  );
  await expect(panel.getByLabel("Prévia de um ano preenchido")).toBeVisible();
  await panel.getByRole("button", { name: /Continuar explorando meu ano/ }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("complementary", { name: "Convite para guardar o ano" })).toBeVisible();
  await expect(
    page.locator('[data-onboarding-auth-entry][data-onboarding-highlighted="true"]')
  ).toBeVisible();
  await expect(page.locator("[data-onboarding-connector]")).toBeVisible();

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
  expect(stored.store?.state?.events).toHaveLength(4);
});

test("configura Trabalho com Entregas, Projetos e Reuniões", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Coberto no fluxo desktop");
  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", { name: "Guia inicial do Doze52" });
  await panel.getByRole("button", { name: /Trabalho/ }).click();
  await expect(panel).toHaveAttribute("data-guided-onboarding-step", "profile_reveal");
  await panel.getByRole("button", { name: "Adicionar datas importantes" }).click();
  await expect(panel).toHaveAttribute("data-guided-onboarding-step", "date_instruction");
  await expect(panel).toContainText("última entrega importante");
  await expect(
    page.locator('[data-onboarding-category-id][data-onboarding-highlighted="true"]').first()
  ).toHaveAttribute("title", "Entregas");

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
  await expect(panel).toHaveAttribute("data-guided-onboarding-step", "profile_reveal");
  await expect(
    page.locator('[data-onboarding-profile-id][data-onboarding-highlighted="true"]').first()
  ).toHaveAttribute("title", "Estudos");

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
