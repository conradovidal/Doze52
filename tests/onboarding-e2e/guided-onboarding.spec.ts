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
    ).toContainText(/Agora escolha o último dia/i);
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
  mobile: boolean
) => {
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  await panel.getByRole("button", { name: /Pessoal/ }).click();
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_category_selection"
  );
  await expect(panel.locator("[data-category-color-swatch]")).toHaveCount(8);
  await expect(panel.locator("[data-category-color-picker]")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Criar categoria" })
  ).toBeDisabled();
  await expect(panel.locator("[data-category-color-swatch]").first()).toBeDisabled();
  await expect(panel).toContainText("Como vamos começar a dar vida ao seu ano?");
  await expect(panel).toContainText(
    "Seu contexto está pronto. Comece pelo aniversário de alguém querido ou por uma data importante."
  );
  await expect(panel).not.toContainText("Um jeito afetivo de começar");
  await panel.getByRole("button", { name: /Aniversários/ }).click();
  const specificChoice = panel.locator(
    '[data-onboarding-category-choice="specific"]'
  );
  const genericChoice = panel.locator(
    '[data-onboarding-category-choice="generic"]'
  );
  await expect(
    panel.locator('[data-category-color-swatch][data-color="#E7B957"]')
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    specificChoice.locator("[data-onboarding-category-color-indicator]")
  ).toHaveCSS("background-color", "rgb(231, 185, 87)");
  await panel
    .locator('[data-category-color-swatch][data-color="#EF8F8F"]')
    .click();
  await expect(
    specificChoice.locator("[data-onboarding-category-color-indicator]")
  ).toHaveCSS("background-color", "rgb(239, 143, 143)");
  await genericChoice.click();
  await expect(
    panel.locator('[data-category-color-swatch][data-color="#4F8FD6"]')
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    genericChoice.locator("[data-onboarding-category-color-indicator]")
  ).toHaveCSS("background-color", "rgb(79, 143, 214)");
  await panel
    .locator('[data-category-color-swatch][data-color="#EBA16D"]')
    .click();
  await expect(
    genericChoice.locator("[data-onboarding-category-color-indicator]")
  ).toHaveCSS("background-color", "rgb(235, 161, 109)");
  await specificChoice.click();
  await expect(
    panel.locator('[data-category-color-swatch][data-color="#EF8F8F"]')
  ).toHaveAttribute("aria-pressed", "true");
  await genericChoice.click();
  await expect(
    panel.locator('[data-category-color-swatch][data-color="#EBA16D"]')
  ).toHaveAttribute("aria-pressed", "true");
  await specificChoice.click();
  await panel
    .getByRole("button", { name: "Criar categoria" })
    .click();
  await expect(panel).toBeHidden();
  await expect(
    page.locator("[data-guided-calendar-notice]")
  ).toHaveAttribute("data-guided-selection-mode", "date");

  await selectGuidedDate(page, mobile, "2026-02-10");
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_details"
  );
  if (mobile) {
    await expect(
      page.locator('[data-mobile-day][data-date-iso="2026-02-10"]')
    ).toHaveAttribute("data-guided-selected", "true");
  } else {
    await expect(
      page.locator('[data-day-cell][data-day-iso="2026-02-10"]')
    ).toHaveAttribute("data-range-selected", "true");
  }
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
  await expect(panel).toContainText(
    "Traga visibilidade aos períodos importantes do seu ano."
  );
  await expect(panel).toContainText(
    "Férias, viagens e outros períodos também ajudam a contar a história do seu ano."
  );
  await panel.getByRole("button", { name: /Férias e viagens/ }).click();
  await expect(
    panel.locator('[data-category-color-swatch][data-color="#72CFE3"]')
  ).toHaveAttribute("aria-pressed", "true");
  await panel
    .getByRole("button", { name: "Criar categoria" })
    .click();
  await expect(panel).toBeHidden();
  await expect(
    page.locator("[data-guided-calendar-notice]")
  ).toHaveAttribute("data-guided-selection-mode", "period");

  await selectGuidedPeriod(page, mobile, "2026-03-10", "2026-03-16");
  if (mobile) {
    await expect(
      page.locator('[data-mobile-day][data-date-iso="2026-03-13"]')
    ).toHaveAttribute("data-guided-selected", "true");
  } else {
    await expect(
      page.locator('[data-day-cell][data-day-iso="2026-03-13"]')
    ).toHaveAttribute("data-range-selected", "true");
  }
  await panel.getByLabel("Nome do período").fill("Últimas férias");
  await panel.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.locator("[data-guided-calendar-notice]")
  ).toHaveAttribute("data-guided-selection-mode", "period");

  await selectGuidedPeriod(page, mobile, "2026-11-10", "2026-11-20");
  await panel.getByLabel("Nome do período").fill("Próximas férias");
  await panel.getByRole("button", { name: "Salvar", exact: true }).click();

  const toolbarNotice = page.locator("[data-guided-toolbar-notice]");
  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "edit"
  );
  const spotlightToolbar = page.locator(
    '[data-onboarding-toolbar-spotlight="true"]'
  );
  await expect(page.locator("[data-onboarding-edit-control]")).toBeDisabled();
  await expect(toolbarNotice).toContainText(
    "Edite contextos e categorias quando precisar"
  );
  await toolbarNotice.getByRole("button", { name: "Continuar" }).click();

  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "calendars"
  );
  await page.locator("[data-onboarding-calendar-control]").click();
  const calendarDialog = page.getByRole("dialog", { name: "Calendários" });
  await expect(calendarDialog).toBeVisible();
  const lockedCalendarCards = calendarDialog.locator(
    '[data-guided-disabled="true"]'
  );
  await expect(lockedCalendarCards.first()).toBeVisible();
  expect(await lockedCalendarCards.count()).toBeGreaterThan(0);
  for (const button of await lockedCalendarCards.getByRole("button").all()) {
    await expect(button).toBeDisabled();
  }
  const stateSelect = calendarDialog.getByRole("combobox", {
    name: /Estado para Feriados nacionais/i,
  });
  await expect(stateSelect).toHaveText(/Escolha seu estado/i);
  await stateSelect.click();
  await page.getByRole("option", { name: "Rio Grande do Sul (RS)" }).click();
  await calendarDialog
    .getByRole("button", { name: "Adicionar feriados" })
    .click();
  await expect(calendarDialog).toBeHidden();

  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "year"
  );
  await expect(page.locator("[data-onboarding-year-control]")).toBeDisabled();
  await toolbarNotice.getByRole("button", { name: "Continuar" }).click();

  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "theme"
  );
  const themeTarget = spotlightToolbar.locator(
    '[data-onboarding-spotlight-target="true"]'
  );
  await expect(themeTarget).toBeVisible();
  await expect(page.locator("[data-onboarding-theme-control]")).not.toHaveCSS(
    "box-shadow",
    "none"
  );
  expect(
    await page
      .locator("[data-onboarding-theme-control]")
      .evaluate((node) => getComputedStyle(node).animationIterationCount)
  ).toBe("1");
  await expect(
    spotlightToolbar
      .locator(':scope > :not([data-onboarding-spotlight-target="true"])')
      .first()
  ).toHaveCSS("opacity", "0.48");
  await expect(
    toolbarNotice.locator("[data-guided-toolbar-arrow]")
  ).toHaveCount(0);
  await page.locator("[data-onboarding-theme-control]").click();
  await page.locator("[data-onboarding-theme-control]").click();
  await toolbarNotice.getByRole("button", { name: "Continuar" }).click();
  await expect(panel).toBeHidden();
  await expect(toolbarNotice).toBeHidden();
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
  const regionRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/onboarding/region")) {
      regionRequests.push(request.url());
    }
  });
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
  await expect(panel).toContainText(
    "Ao fundo está o ano de alguém com prioridades próprias"
  );
  await expect(panel).not.toContainText(/\bperfil\b/i);
  await expect(panel).not.toContainText(/\bcadastr/i);

  await completePersonalOnboarding(page, mobile);
  expect(regionRequests).toEqual([]);

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
        categories?: Array<{ name: string; color: string }>;
        events?: Array<{
          title: string;
          recurrenceType?: string;
        }>;
      };
    } | null,
  }));

  expect(stored.onboarding).toMatchObject({
    version: 8,
    step: "completed",
    context: "personal",
  });
  expect(stored.store?.state?.profiles?.[0]?.name).toBe("Pessoal");
  expect(stored.store?.state?.categories?.map((item) => item.name)).toEqual([
    "Aniversários",
    "Férias e viagens",
    "Feriados",
  ]);
  expect(stored.store?.state?.categories?.slice(0, 2).map((item) => item.color)).toEqual([
    "#EF8F8F",
    "#72CFE3",
  ]);
  expect(stored.store?.state?.events?.length).toBeGreaterThan(4);
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

test("primeira visita segue o sistema e o onboarding usa superfície inversa", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Aparência adaptativa coberta no desktop"
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?mobileUi=0");
  await expect(page.locator("html")).toHaveClass(/dark/);
  const panel = page.locator("[data-onboarding-panel]");
  await expect(panel).toBeVisible();
  expect(
    await panel.evaluate((node) => getComputedStyle(node).backgroundColor)
  ).toBe("rgb(255, 255, 255)");

  await page.evaluate(() => localStorage.setItem("doze52-theme", "light"));
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(
    await panel.evaluate((node) => getComputedStyle(node).backgroundColor)
  ).toBe("rgb(23, 34, 51)");
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

test("controle temporário reinicia dados locais e restaura a demonstração", async ({
  page,
}) => {
  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  await panel.getByRole("button", { name: /Pessoal/ }).click();
  await panel.getByRole("button", { name: /Aniversários/ }).click();
  await panel
    .getByRole("button", { name: "Criar categoria" })
    .click();
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(1);

  await page.locator("[data-onboarding-test-reset]").click();
  await page.waitForLoadState("domcontentloaded");

  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "context_selection"
  );
  await expect(page.locator("[data-onboarding-profile-id]")).toHaveCount(3);
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(6);
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
  const calendarAnchor = mobile
    ? page.locator("[data-mobile-calendar-divider]")
    : page.locator("[data-year-grid]");
  const beforeSelection = await calendarAnchor.boundingBox();
  await panel.getByRole("button", { name: /Aniversários/ }).click();
  await panel
    .getByRole("button", { name: "Criar categoria" })
    .click();

  await expect(panel).toBeHidden();
  const notice = page.locator("header [data-guided-calendar-notice]");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    "Adicione o aniversário de alguém importante"
  );
  await expect(notice).not.toContainText(/\bcadastr/i);
  await expect(
    page.locator("[data-year-grid] [data-guided-calendar-notice]")
  ).toHaveCount(0);
  const filterRegion = page.locator("[data-onboarding-filter-region]");
  const overlay = page.locator("[data-guided-selection-overlay]");
  const noticeCard = page.locator("[data-guided-selection-card]");
  const [filterBox, overlayBox, noticeBox] = await Promise.all([
    filterRegion.boundingBox(),
    overlay.boundingBox(),
    noticeCard.boundingBox(),
  ]);
  if (!filterBox || !overlayBox || !noticeBox) {
    throw new Error("Sobreposição do cabeçalho não renderizada");
  }
  expect(Math.abs(filterBox.x - overlayBox.x)).toBeLessThan(1);
  expect(Math.abs(filterBox.width - overlayBox.width)).toBeLessThan(1);
  expect(noticeBox.width).toBeLessThan(overlayBox.width);
  const noticeTitleFontSize = await notice
    .locator("p")
    .first()
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(noticeTitleFontSize).toBeGreaterThanOrEqual(16);
  const afterSelection = await calendarAnchor.boundingBox();
  if (!beforeSelection || !afterSelection) {
    throw new Error("Calendário não renderizado");
  }
  expect(Math.abs(beforeSelection.y - afterSelection.y)).toBeLessThan(1.1);
});

test("dois eventos espontâneos disparam o convite de conta", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Criação normal coberta no desktop"
  );
  await page.addInitScript(() => {
    window.localStorage.setItem("doze52-theme", "light");
  });
  await page.goto("/?mobileUi=0");
  await completePersonalOnboarding(page, false);

  const nudge = page.getByRole("complementary", {
    name: "Convite para guardar o ano",
  });
  await createRegularEvent(page, "2026-06-02", "Evento espontâneo 1");
  await expect(nudge).toBeHidden();
  await createRegularEvent(page, "2026-07-03", "Evento espontâneo 2");
  await expect(nudge).toBeVisible();
  await expect(nudge).toContainText("Seu ano começou a tomar forma.");
  await expect(nudge).toContainText(
    "Crie sua conta para guardar essa visão, acessá-la em qualquer dispositivo e usar seu ano como apoio para planejar o que vem pela frente."
  );
  await expect(
    nudge.getByRole("button", { name: "Guardar meu ano" })
  ).toBeVisible();
  await expect(nudge.locator('[data-account-nudge-icon="calendar"]')).toBeVisible();
  await expect(nudge).toHaveCSS("background-color", "rgb(23, 34, 51)");

  await page.locator("[data-onboarding-theme-control]").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(nudge).toHaveCSS("background-color", "rgb(255, 255, 255)");

  await nudge.getByRole("button", { name: "Fechar convite" }).click();
  await page.reload();
  await expect(nudge).toBeHidden();
});

test("spotlight respeita redução de movimento", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Preferência de movimento coberta no desktop"
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?mobileUi=0");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({
        version: 8,
        step: "theme_instruction",
        context: "personal",
        dateItemsCreated: 2,
        periodItemsCreated: 2,
      })
    );
  });
  await page.reload();

  const themeControl = page.locator("[data-onboarding-theme-control]");
  await expect(themeControl).toHaveAttribute("data-onboarding-highlighted", "true");
  await expect(themeControl).toHaveCSS("animation-name", "none");
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

  await panel.getByRole("button", { name: /Datas importantes/ }).click();
  await panel
    .getByRole("button", { name: "Criar categoria" })
    .click();
  await expect(
    page.locator(
      '[data-onboarding-category-id][data-onboarding-highlighted="true"]'
    )
  ).toHaveAttribute("title", "Datas importantes");
});
