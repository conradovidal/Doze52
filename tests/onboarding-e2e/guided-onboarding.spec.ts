import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const marker = "doze52:e2e:initialized";
    if (window.sessionStorage.getItem(marker)) return;
    window.localStorage.clear();
    window.sessionStorage.setItem(marker, "true");
  });
});

const selectGuidedDate = async (
  page: Page,
  mobile: boolean,
  dateIso: string
) => {
  if (mobile) {
    await page
      .getByRole("button", {
        name: `Selecionar ${dateIso} no guia inicial`,
      })
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
    await expect(
      page.locator("[data-guided-calendar-notice]")
    ).toContainText(/Início selecionado/i);
    await selectGuidedDate(page, true, endIso);
    return;
  }
  const start = page.locator(`[data-day-cell][data-day-iso="${startIso}"]`);
  const end = page.locator(`[data-day-cell][data-day-iso="${endIso}"]`);
  await start.scrollIntoViewIfNeeded();
  await end.scrollIntoViewIfNeeded();
  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  if (!startBox || !endBox) throw new Error("Datas não renderizadas");
  await page.mouse.move(
    startBox.x + startBox.width / 2,
    startBox.y + startBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    endBox.x + endBox.width / 2,
    endBox.y + endBox.height / 2,
    { steps: 8 }
  );
  await page.mouse.up();
};

const completePersonalOnboarding = async (
  page: Page,
  mobile: boolean,
  finish: "explore" | "category"
) => {
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  await panel.getByRole("button", { name: /Pessoal/ }).click();
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "profile_reveal"
  );
  await panel
    .getByRole("button", { name: "Escolher primeira categoria" })
    .click();
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_category_selection"
  );
  await panel.getByRole("button", { name: /Aniversários/ }).click();
  await expect(panel).toBeHidden();
  await expect(
    page.locator("[data-guided-calendar-notice]")
  ).toHaveAttribute("data-guided-selection-mode", "date");

  await selectGuidedDate(page, mobile, "2026-02-10");
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_details"
  );
  await selectGuidedDate(page, mobile, "2026-02-11");
  await expect(panel).toContainText(/11.*fev/i);
  await expect(
    page.getByRole("dialog", { name: "Novo evento" })
  ).toBeHidden();
  await expect(panel.getByRole("button", { name: "Mais opções" })).toHaveCount(
    0
  );
  await panel.getByLabel("Nome da data").fill("Aniversário da mãe");
  await panel.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.locator("[data-guided-calendar-notice]")
  ).toHaveAttribute("data-guided-selection-mode", "date");

  await selectGuidedDate(page, mobile, "2026-09-12");
  await panel.getByLabel("Nome da data").fill("Aniversário do pai");
  await panel.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "period_category_selection"
  );
  await panel.getByRole("button", { name: /Férias e viagens/ }).click();
  await expect(panel).toBeHidden();
  await expect(
    page.locator("[data-guided-calendar-notice]")
  ).toHaveAttribute("data-guided-selection-mode", "period");

  await selectGuidedPeriod(page, mobile, "2026-03-10", "2026-03-16");
  await panel.getByLabel("Nome do período").fill("Últimas férias");
  await panel.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.locator("[data-guided-calendar-notice]")
  ).toHaveAttribute("data-guided-selection-mode", "period");

  await selectGuidedPeriod(page, mobile, "2026-11-10", "2026-11-20");
  await panel.getByLabel("Nome do período").fill("Próximas férias");
  await panel.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "completion_choice"
  );
  await panel
    .getByRole("button", {
      name:
        finish === "explore"
          ? "Explorar meu ano"
          : "Continuar personalizando",
    })
    .click();
  await expect(panel).toBeHidden();
};

const createRegularEvent = async (
  page: Page,
  dateIso: string,
  title: string
) => {
  await page.locator(`[data-day-cell][data-day-iso="${dateIso}"]`).click();
  const dialog = page.getByRole("dialog", { name: "Novo evento" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Título do evento").fill(title);
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toBeHidden();
};

test("monta contexto Pessoal de forma incremental", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  await page.goto(mobile ? "/?mobileUi=1" : "/?mobileUi=0");
  await expect(page).toHaveTitle("Doze 52 | Seu ano em uma página");

  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "context_selection"
  );
  await expect(panel.getByRole("button", { name: /Outro/ })).toHaveCount(0);
  await expect(page.locator("[data-onboarding-profile-id]")).toHaveCount(3);
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(6);
  await expect(page.locator("[data-onboarding-connector]")).toHaveCount(0);
  await expect(panel).toContainText("O ano da Marina está ao fundo");
  await expect(panel).not.toContainText(/\bperfil\b/i);
  await expect(panel).not.toContainText(/\bcadastr/i);

  await completePersonalOnboarding(page, mobile, "explore");

  await expect(
    page.getByRole("complementary", {
      name: "Convite para guardar o ano",
    })
  ).toBeHidden();

  const stored = await page.evaluate(() => ({
    onboarding: JSON.parse(
      window.localStorage.getItem("doze52:onboarding:v2") ?? "null"
    ) as { version?: number; step?: string; context?: string } | null,
    store: JSON.parse(window.localStorage.getItem("yiv-store") ?? "null") as {
      state?: {
        profiles?: Array<{ name: string }>;
        categories?: Array<{ name: string }>;
        events?: Array<{
          title: string;
          recurrenceType?: string;
        }>;
      };
    } | null,
  }));

  expect(stored.onboarding).toMatchObject({
    version: 4,
    step: "completed",
    context: "personal",
  });
  expect(stored.store?.state?.profiles?.[0]?.name).toBe("Pessoal");
  expect(stored.store?.state?.categories?.map((item) => item.name)).toEqual([
    "Aniversários",
    "Férias e viagens",
  ]);
  expect(stored.store?.state?.events).toHaveLength(4);
  expect(
    stored.store?.state?.events
      ?.filter((event) => event.title.startsWith("Aniversário"))
      .every((event) => event.recurrenceType === "yearly")
  ).toBe(true);
});

test("categorias começam abertas, podem ser recolhidas e reabrem ao recarregar", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  await page.goto(mobile ? "/?mobileUi=1" : "/?mobileUi=0");

  await page
    .getByRole("button", { name: "Encerrar guia inicial" })
    .click();

  const expandedLabel = mobile
    ? "Recolher contextos e categorias"
    : "Recolher categorias";
  const collapsedLabel = mobile
    ? "Mostrar contextos e categorias"
    : "Mostrar categorias";
  const expandedToggle = page.getByRole("button", { name: expandedLabel });
  await expect(expandedToggle).toHaveAttribute("aria-expanded", "true");
  await expandedToggle.click();
  await expect(
    page.getByRole("button", { name: collapsedLabel })
  ).toHaveAttribute("aria-expanded", "false");

  await page.reload();
  await expect(
    page.getByRole("button", { name: expandedLabel })
  ).toHaveAttribute("aria-expanded", "true");
});

test("o X encerra o guia e a decisão persiste após recarregar", async ({
  page,
}) => {
  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  await panel.getByRole("button", { name: "Encerrar guia inicial" }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByText("Dispensar ajuda")).toHaveCount(0);
  const stored = await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem("yiv-store") ?? "{}");
    return payload.state as {
      profiles?: Array<{ name: string }>;
      categories?: unknown[];
      events?: unknown[];
    };
  });
  expect(stored.profiles?.map((profile) => profile.name)).toEqual(["Meu ano"]);
  expect(stored.categories).toEqual([]);
  expect(stored.events).toEqual([]);

  await page.reload();
  await expect(panel).toBeHidden();
  await expect(page.locator("[data-guided-calendar-notice]")).toHaveCount(0);
});

test("centraliza cards e sobrepõe a instrução ao cabeçalho sem mover o calendário", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  await page.goto(mobile ? "/?mobileUi=1" : "/?mobileUi=0");
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  if (!mobile) {
    const panelBox = await panel.boundingBox();
    const viewport = page.viewportSize();
    if (!panelBox || !viewport) throw new Error("Card inicial não renderizado");
    expect(
      Math.abs(panelBox.x + panelBox.width / 2 - viewport.width / 2)
    ).toBeLessThan(3);
    expect(
      Math.abs(panelBox.y + panelBox.height / 2 - viewport.height / 2)
    ).toBeLessThan(3);
  }

  await panel.getByRole("button", { name: /Pessoal/ }).click();
  const cleanSnapshot = await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem("yiv-store") ?? "{}");
    return payload.state as {
      profiles?: Array<{ name: string }>;
      categories?: unknown[];
      events?: unknown[];
    };
  });
  expect(cleanSnapshot.profiles?.map((profile) => profile.name)).toEqual([
    "Pessoal",
  ]);
  expect(cleanSnapshot.categories).toEqual([]);
  expect(cleanSnapshot.events).toEqual([]);
  await panel
    .getByRole("button", { name: "Escolher primeira categoria" })
    .click();
  const calendarAnchor = mobile
    ? page.locator("[data-mobile-calendar-divider]")
    : page.locator("[data-year-grid]");
  const beforeSelection = await calendarAnchor.boundingBox();
  await panel.getByRole("button", { name: /Aniversários/ }).click();

  await expect(panel).toBeHidden();
  const notice = page.locator("header [data-guided-calendar-notice]");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    "Escolha no calendário um aniversário que já passou"
  );
  await expect(notice).not.toContainText(/\bcadastr/i);
  await expect(
    page.locator("[data-year-grid] [data-guided-calendar-notice]")
  ).toHaveCount(0);
  const afterSelection = await calendarAnchor.boundingBox();
  if (!beforeSelection || !afterSelection) {
    throw new Error("Calendário não renderizado");
  }
  expect(Math.abs(beforeSelection.y - afterSelection.y)).toBeLessThan(3);
});

test("dois eventos espontâneos disparam o convite de conta", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Criação normal coberta no desktop"
  );
  await page.goto("/?mobileUi=0");
  await completePersonalOnboarding(page, false, "explore");

  const nudge = page.getByRole("complementary", {
    name: "Convite para guardar o ano",
  });
  await createRegularEvent(page, "2026-06-02", "Evento espontâneo 1");
  await expect(nudge).toBeHidden();
  await createRegularEvent(page, "2026-07-03", "Evento espontâneo 2");
  await expect(nudge).toBeVisible();

  await nudge.getByRole("button", { name: "Fechar convite" }).click();
  await page.reload();
  await expect(nudge).toBeHidden();
});

test("terceira categoria e um evento disparam o convite", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Gerenciador de categoria coberto no desktop"
  );
  await page.goto("/?mobileUi=0");
  await completePersonalOnboarding(page, false, "category");

  const categoryDialog = page.getByRole("dialog", {
    name: "Nova categoria",
  });
  await expect(categoryDialog).toBeVisible();
  await categoryDialog.getByLabel("Nome da categoria").fill("Celebrações");
  await categoryDialog.getByRole("button", { name: "Criar" }).click();
  await expect(categoryDialog).toBeHidden();

  const nudge = page.getByRole("complementary", {
    name: "Convite para guardar o ano",
  });
  await expect(nudge).toBeHidden();
  await createRegularEvent(page, "2026-06-05", "Celebração espontânea");
  await expect(nudge).toBeVisible();
});

test("Profissional permite categorias específica e genérica", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Variações de contexto cobertas no desktop"
  );
  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  await panel.getByRole("button", { name: /Profissional/ }).click();
  await expect(
    page.locator('[data-onboarding-profile-id][title="Profissional"]')
  ).toBeVisible();
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(0);

  await panel
    .getByRole("button", { name: "Escolher primeira categoria" })
    .click();
  await panel.getByRole("button", { name: /Datas importantes/ }).click();
  await expect(
    page.locator(
      '[data-onboarding-category-id][data-onboarding-highlighted="true"]'
    )
  ).toHaveAttribute("title", "Datas importantes");
});
