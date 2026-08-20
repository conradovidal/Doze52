import { expect, test, type Locator, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const marker = "doze52:e2e:initialized";
    if (window.sessionStorage.getItem(marker)) return;
    window.localStorage.clear();
    window.sessionStorage.setItem(marker, "true");
  });
});

const clickBehindGuidedPanel = async (page: Page, target: Locator) => {
  const panel = page.locator("[data-onboarding-panel]");
  await panel.evaluateAll((nodes) => {
    nodes.forEach((node) => {
      (node as HTMLElement).style.pointerEvents = "none";
    });
  });
  try {
    await target.click();
  } finally {
    await panel.evaluateAll((nodes) => {
      nodes.forEach((node) => {
        (node as HTMLElement).style.pointerEvents = "";
      });
    });
  }
};

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
  await clickBehindGuidedPanel(
    page,
    page.locator(`[data-day-cell][data-day-iso="${dateIso}"]`)
  );
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
  await expect(panel).toContainText("O que você quer tornar visível primeiro?");
  await expect(panel).toContainText(
    "Seu contexto Pessoal está pronto. Comece pelo aniversário de alguém importante ou por uma data que você quer lembrar."
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
  const revealedDateCategory = page.locator(
    '[data-onboarding-category-id][data-onboarding-highlight-effect="reveal"]'
  );
  await expect(revealedDateCategory).toHaveAttribute("title", "Aniversários");
  await expect(page.locator("[data-guided-calendar-notice]")).toHaveCount(0);
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
    "Quais períodos você quer tornar visíveis?"
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
    page.locator(
      '[data-onboarding-category-id][data-onboarding-highlight-effect="reveal"]'
    )
  ).toHaveAttribute("title", "Férias e viagens");
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
  await expect(page.locator("[data-onboarding-edit-control]")).toBeEnabled();
  await expect(toolbarNotice).toContainText(
    "Veja como editar contextos e categorias"
  );
  await expect(toolbarNotice.locator("p").nth(1)).not.toHaveCSS(
    "text-wrap-style",
    "balance"
  );
  const editNoticeBox = await toolbarNotice.boundingBox();
  const viewport = page.viewportSize();
  if (!editNoticeBox || !viewport) {
    throw new Error("Coachmark de edição não renderizado");
  }
  expect(editNoticeBox.width).toBeLessThanOrEqual(352.5);
  expect(editNoticeBox.x).toBeGreaterThanOrEqual(-0.5);
  expect(editNoticeBox.x + editNoticeBox.width).toBeLessThanOrEqual(
    viewport.width + 0.5
  );
  await expect(
    toolbarNotice.getByRole("button", { name: "Encerrar guia inicial" })
  ).toHaveCSS("position", "absolute");
  await page.locator("[data-onboarding-edit-control]").click();
  await expect(toolbarNotice).toContainText("Este é o modo de edição");
  const filterRegion = page.locator("[data-onboarding-filter-region]");
  await expect(filterRegion.locator(":scope > div").first()).not.toHaveAttribute(
    "inert",
    ""
  );
  const beforeEditPreview = await page.evaluate(() =>
    window.localStorage.getItem("yiv-store")
  );
  const finishEdit = page.locator("[data-onboarding-edit-control]");
  await expect(finishEdit).toContainText("Finalizar");
  await finishEdit.click();
  expect(await page.evaluate(() => window.localStorage.getItem("yiv-store"))).toBe(
    beforeEditPreview
  );

  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "calendars"
  );
  await expect(toolbarNotice).toContainText(
    "Complemente seu ano com calendários prontos."
  );
  await expect(toolbarNotice).toContainText(
    "Adicione os feriados do seu estado."
  );
  await page.locator("[data-onboarding-calendar-control]").click();
  const calendarDialog = page.getByRole("dialog", {
    name: "Adicione os feriados do seu estado",
  });
  await expect(calendarDialog).toBeVisible();
  await expect(calendarDialog).toContainText(
    "Escolha sua UF para incluir este calendário no contexto Pessoal."
  );
  const calendarCards = calendarDialog.locator("[data-calendar-pack-group]");
  await expect(calendarCards.first()).toBeVisible();
  expect(await calendarCards.count()).toBeGreaterThan(1);
  await expect(calendarDialog.locator('[data-guided-disabled="true"]')).toHaveCount(0);
  const stateSelect = calendarDialog.getByRole("combobox", {
    name: /Estado para Feriados nacionais/i,
  });
  await expect(stateSelect).toHaveText(/São Paulo \(SP\)/i);
  await calendarDialog
    .getByRole("button", { name: "Adicionar feriados" })
    .click();
  await expect(calendarDialog).toBeHidden();
  const importedHolidayTitles = await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem("yiv-store") ?? "{}");
    return (payload.state?.events ?? []).map(
      (event: { title?: string }) => event.title
    );
  });
  expect(importedHolidayTitles).toContain("9 de Julho — Data Magna de São Paulo");
  expect(importedHolidayTitles).not.toContain("Revolução Farroupilha");

  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "year"
  );
  const yearControl = page.locator("[data-onboarding-year-control]");
  await expect(yearControl).toBeEnabled();
  await yearControl.click();
  await expect(toolbarNotice).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(toolbarNotice).toBeVisible();
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
  await toolbarNotice.getByRole("button", { name: "Explorar meu ano" }).click();
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
  test.skip(mobile, "O onboarding guiado começa exclusivamente no desktop");
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
  await expect(page.locator("[data-onboarding-profile-id]")).toHaveCount(2);
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(7);
  await expect(page.locator("[data-onboarding-connector]")).toHaveCount(0);
  await expect(panel).toContainText(
    "Escolha onde começar a dar visibilidade ao que importa para você."
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
    version: 11,
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

test("motion premium preserva progresso, escala e editor contextual", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "O controle de escala e o popover contextual são exclusivos do desktop"
  );

  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", { name: "Guia inicial do Doze 52" });
  const onboardingProgress = panel.getByRole("progressbar", {
    name: "Progresso do guia inicial",
  });
  await expect(onboardingProgress).toHaveAttribute("aria-valuenow", "14");

  await completePersonalOnboarding(page, false);

  const scale = page.getByRole("radiogroup", { name: "Escala do calendário" });
  await expect(scale).toBeVisible();
  await scale.getByRole("radio", { name: "Trimestre" }).click();
  const zoomControl = page.getByLabel("Zoom do calendário");
  await expect(zoomControl).toBeVisible();
  await zoomControl.press("Home");
  const focusedMonthRow = page.locator(
    `[data-month-row="${new Date().getMonth()}"]`
  );
  const rowHeightAtMinimumZoom = await focusedMonthRow.evaluate(
    (element) => element.getBoundingClientRect().height
  );
  await zoomControl.press("End");
  await expect(zoomControl).toHaveAttribute(
    "aria-valuetext",
    "180% na horizontal e 140% na vertical"
  );
  await expect
    .poll(() =>
      focusedMonthRow.evaluate((element) => element.getBoundingClientRect().height)
    )
    .toBeGreaterThan(rowHeightAtMinimumZoom * 1.3);
  await scale.getByRole("radio", { name: "Mês" }).click();
  await expect(scale.getByRole("radio", { name: "Mês" })).toHaveAttribute(
    "aria-checked",
    "true"
  );
  const currentMonthLabel = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ][new Date().getMonth()];
  await expect(
    page.getByRole("button", { name: /Voltar para .* trimestre/ })
  ).toHaveText(currentMonthLabel);
  await scale.getByRole("radio", { name: "Ano" }).click();
  await expect(page.getByLabel("Zoom do calendário")).toHaveCount(0);

  const targetDay = page.locator('[data-day-cell][data-day-iso="2026-02-03"]');
  await targetDay.click({ force: true });
  const editor = page.getByRole("dialog", { name: "Novo evento" });
  await expect(editor).toHaveAttribute("data-slot", "popover-content");
  const editorBox = await editor.boundingBox();
  const viewport = page.viewportSize();
  expect(editorBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(editorBox!.x).toBeGreaterThanOrEqual(0);
  expect(editorBox!.y).toBeGreaterThanOrEqual(0);
  expect(editorBox!.x + editorBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(editorBox!.y + editorBox!.height).toBeLessThanOrEqual(viewport!.height);
  await page.keyboard.press("Escape");
  await expect(editor).toBeHidden();
  await expect(targetDay).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mobileUi=1");
  await expect(
    page.getByRole("radiogroup", { name: "Escala do calendário" })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Novo evento" }).click();
  const mobileEditor = page.getByRole("dialog", { name: "Novo evento" });
  await expect(mobileEditor).toHaveAttribute("data-slot", "dialog-content");
  const mobileEditorBox = await mobileEditor.boundingBox();
  expect(mobileEditorBox).not.toBeNull();
  expect(mobileEditorBox!.x).toBeGreaterThanOrEqual(0);
  expect(mobileEditorBox!.x + mobileEditorBox!.width).toBeLessThanOrEqual(390);
});

test("ano de exemplo gerencia Feriados do RS e Corridas F1 sem duplicar", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Catálogo completo do exemplo validado no desktop"
  );
  await page.goto("/?mobileUi=0");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const payload = JSON.parse(
          window.localStorage.getItem("yiv-store") ?? "{}"
        );
        return new Set(
          (payload.state?.categories ?? [])
            .map(
              (category: { calendarPackGroupId?: string }) =>
                category.calendarPackGroupId
            )
            .filter(Boolean)
        ).size;
      })
    )
    .toBeGreaterThanOrEqual(3);

  const openCalendars = () =>
    page
      .getByRole("button", { name: "Adicionar ou gerenciar calendários." })
      .click();
  const waitForHolidayVariant = (variantId: string | null) =>
    expect
      .poll(() =>
        page.evaluate(() => {
          const payload = JSON.parse(
            window.localStorage.getItem("yiv-store") ?? "{}"
          );
          return (
            (payload.state?.categories ?? []).find(
              (category: { calendarPackGroupId?: string }) =>
                category.calendarPackGroupId === "holidays-by-state"
            )?.calendarPackVariantId ?? null
          );
        })
      )
      .toBe(variantId);
  await openCalendars();
  const dialog = page.getByRole("dialog", { name: "Calendários" });
  const holidayCard = dialog.locator(
    '[data-calendar-pack-group="holidays-by-state"]'
  );
  const formulaCard = dialog.locator(
    '[data-calendar-pack-group="formula-1-2026"]'
  );
  await expect(holidayCard.getByRole("button", { name: "Remover" })).toBeVisible();
  await expect(formulaCard.getByRole("button", { name: "Remover" })).toBeVisible();

  const stateSelect = holidayCard.getByRole("combobox", {
    name: /Estado para Feriados nacionais/i,
  });
  await expect(stateSelect).toHaveText(/Rio Grande do Sul \(RS\)/i);
  await stateSelect.click();
  await page.getByRole("option", { name: /São Paulo \(SP\)/i }).click();
  await holidayCard.getByRole("button", { name: "Trocar estado" }).click();

  const switchedState = await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem("yiv-store") ?? "{}");
    const categories = payload.state?.categories ?? [];
    const events = payload.state?.events ?? [];
    return {
      holidayCategories: categories.filter(
        (category: { calendarPackGroupId?: string }) =>
          category.calendarPackGroupId === "holidays-by-state"
      ),
      titles: events.map((event: { title?: string }) => event.title),
    };
  });
  expect(switchedState.holidayCategories).toHaveLength(1);
  expect(switchedState.holidayCategories[0]?.calendarPackVariantId).toBe(
    "holidays-sao-paulo"
  );
  expect(switchedState.titles).toContain(
    "9 de Julho — Data Magna de São Paulo"
  );
  expect(switchedState.titles).not.toContain("Revolução Farroupilha");

  await page.keyboard.press("Escape");
  await page.reload();
  await waitForHolidayVariant("holidays-sao-paulo");
  await openCalendars();
  await expect(stateSelect).toHaveText(/São Paulo \(SP\)/i);
  await holidayCard.getByRole("button", { name: "Remover" }).click();
  await page.keyboard.press("Escape");
  await page.reload();
  await waitForHolidayVariant(null);
  await expect(
    page.getByRole("button", { name: "Feriados", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Corridas F1", exact: true })
  ).toBeVisible();
  await openCalendars();
  await expect(
    holidayCard.getByRole("button", { name: "Adicionar calendário" })
  ).toBeVisible();
  await expect(formulaCard.getByRole("button", { name: "Remover" })).toBeVisible();
});

test("seletor de destino integra o card de mover eventos", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Responsividade do diálogo validada no mesmo viewport controlado"
  );
  await page.goto("/?mobileUi=0");
  await page.getByRole("button", { name: "Encerrar guia inicial" }).click();
  await page.getByRole("button", { name: "Encerrar e explorar" }).click();
  await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem("yiv-store") ?? "{}");
    payload.state.categories = (payload.state.categories ?? []).map(
      (category: {
        calendarPackGroupId?: string;
        calendarPackVariantId?: string;
        calendarPackCategoryKey?: string;
        calendarPackVersion?: number;
      }) =>
        category.calendarPackGroupId?.startsWith("onboarding-personal-demo-")
          ? {
              ...category,
              calendarPackGroupId: undefined,
              calendarPackVariantId: undefined,
              calendarPackCategoryKey: undefined,
              calendarPackVersion: undefined,
            }
          : category
    );
    payload.state.events = (payload.state.events ?? []).map(
      (event: {
        calendarPackGroupId?: string;
        calendarPackEventKey?: string;
      }) =>
        event.calendarPackGroupId?.startsWith("onboarding-personal-demo-")
          ? {
              ...event,
              calendarPackGroupId: undefined,
              calendarPackEventKey: undefined,
            }
          : event
    );
    window.localStorage.setItem("yiv-store", JSON.stringify(payload));
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const payload = JSON.parse(
          window.localStorage.getItem("yiv-store") ?? "{}"
        );
        return (
          (payload.state?.categories ?? []).find(
            (category: { name?: string }) => category.name === "Família"
          )?.calendarPackGroupId ?? null
        );
      })
    )
    .toBeNull();
  const editWorkspace = page.getByRole("button", {
    name: "Editar contextos e categorias",
  });
  const finishWorkspaceEdit = page.getByRole("button", {
    name: "Finalizar edição de contextos e categorias",
  });
  await expect(async () => {
    await editWorkspace.click();
    await expect(finishWorkspaceEdit).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 10_000 });
  await page
    .getByRole("button", { name: "Editar categoria Família" })
    .first()
    .click();
  const categoryDialog = page.getByRole("dialog", { name: "Editar categoria" });
  await categoryDialog.getByRole("button", { name: "Deletar" }).click();

  const deleteDialog = page.getByRole("dialog", { name: "Excluir categoria" });
  const moveLabel = deleteDialog.getByText("Mover eventos", { exact: true });
  const destination = deleteDialog.getByRole("combobox", {
    name: "Categoria de destino dos eventos",
  });
  const [desktopLabelBox, desktopSelectBox] = await Promise.all([
    moveLabel.boundingBox(),
    destination.boundingBox(),
  ]);
  if (!desktopLabelBox || !desktopSelectBox) {
    throw new Error("Opção de movimentação não renderizada");
  }
  expect(desktopSelectBox.x).toBeGreaterThan(desktopLabelBox.x);

  await deleteDialog
    .getByText(/Excluir categoria e \d+ eventos/, { exact: true })
    .click();
  await destination.click();
  await page.getByRole("option", { name: "Aniversários · Pessoal" }).click();
  await expect(
    deleteDialog.locator('input[value="move"]')
  ).toBeChecked();

  await page.setViewportSize({ width: 390, height: 844 });
  const [mobileLabelBox, mobileSelectBox] = await Promise.all([
    moveLabel.boundingBox(),
    destination.boundingBox(),
  ]);
  if (!mobileLabelBox || !mobileSelectBox) {
    throw new Error("Opção responsiva de movimentação não renderizada");
  }
  expect(mobileSelectBox.y).toBeGreaterThan(mobileLabelBox.y);
  await deleteDialog.getByRole("button", { name: "Cancelar" }).click();
});

test("mobile recomenda o desktop e libera uma prévia somente na sessão", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "Entrada desktop-first validada no viewport mobile"
  );

  await page.goto("/?mobileUi=1");

  const gate = page.locator("[data-mobile-desktop-first-gate]");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("Comece pelo desktop.");
  await expect(gate).toContainText(
    "O Doze 52 foi pensado para montar e visualizar o ano inteiro em uma tela maior."
  );
  await expect(
    page.getByRole("region", { name: "Guia inicial do Doze 52" })
  ).toHaveCount(0);
  const onboardingBeforePreview = await page.evaluate(() =>
    window.localStorage.getItem("doze52:onboarding:v2")
  );

  await gate.getByRole("button", { name: "Entrar na minha conta" }).click();
  const authDialog = page.getByRole("dialog", { name: "Entrar" });
  await expect(authDialog).toBeVisible();
  await authDialog.getByRole("button", { name: "Cancelar" }).click();

  await gate
    .getByRole("button", { name: "Explorar o ano de exemplo" })
    .click();
  await expect(gate).toBeHidden();
  await expect(page.locator("[data-mobile-calendar-experience]")).toBeVisible();
  await expect(page.locator("[data-onboarding-edit-control]")).toBeDisabled();
  await expect(page.locator("[data-onboarding-calendar-control]")).toBeDisabled();
  await expect(page.locator("[data-onboarding-year-control]")).toBeEnabled();
  await expect(page.locator("[data-onboarding-theme-control]")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Novo evento" })).toHaveCount(0);

  await page.locator('[data-onboarding-profile-id][title="Profissional"]').click();
  await expect(
    page.locator('[data-onboarding-category-id][title="Produto"]')
  ).toBeVisible();

  const persisted = await page.evaluate(() => ({
    sessionPreview: window.sessionStorage.getItem(
      "doze52:mobile-example-preview:session"
    ),
    onboardingRaw: window.localStorage.getItem("doze52:onboarding:v2"),
  }));
  expect(persisted.sessionPreview).toBe("1");
  expect(persisted.onboardingRaw).toBe(onboardingBeforePreview);

  await page.reload();
  await expect(gate).toBeHidden();

  await page.goto("/?mobileUi=0");
  await expect(
    page.getByRole("region", { name: "Guia inicial do Doze 52" })
  ).toHaveAttribute("data-guided-onboarding-step", "context_selection");
});

test("mobile preserva progresso parcial e exige continuação no desktop", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "Retomada desktop-first validada no viewport mobile"
  );

  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  await panel.getByRole("button", { name: /Pessoal/ }).click();
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_category_selection"
  );

  await page.goto("/?mobileUi=1");
  const gate = page.locator("[data-mobile-desktop-first-gate]");
  await expect(gate).toContainText(
    "Continue a montagem do seu ano no desktop."
  );
  await expect(
    gate.getByRole("button", { name: "Explorar o ano de exemplo" })
  ).toHaveCount(0);
  await expect(panel).toHaveCount(0);

  const persisted = await page.evaluate(() => ({
    sessionPreview: window.sessionStorage.getItem(
      "doze52:mobile-example-preview:session"
    ),
    onboarding: JSON.parse(
      window.localStorage.getItem("doze52:onboarding:v2") ?? "null"
    ) as { step?: string } | null,
  }));
  expect(persisted.sessionPreview).toBeNull();
  expect(persisted.onboarding?.step).toBe("date_category_selection");
});

test("categorias recolhidas liberam espaço e recentralizam hoje", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  test.skip(mobile, "Comportamento do cabeçalho coberto no desktop");
  await page.goto(mobile ? "/?mobileUi=1" : "/?mobileUi=0");

  await page
    .getByRole("button", { name: "Encerrar guia inicial" })
    .click();
  await page
    .getByRole("button", { name: "Encerrar e explorar" })
    .click();

  const expandedLabel = mobile
    ? "Recolher contextos e categorias"
    : "Recolher categorias";
  const collapsedLabel = mobile
    ? "Mostrar contextos e categorias"
    : "Mostrar categorias";
  const expandedToggle = page.getByRole("button", { name: expandedLabel });
  await expect(expandedToggle).toHaveAttribute("aria-expanded", "true");

  const scrollRegion = page.locator("[data-desktop-calendar-scroll-region]");
  const currentDateIso = await page.evaluate(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  });
  const todayCell = page.locator(
    `[data-day-cell][data-day-iso="${currentDateIso}"]`
  );
  await expect
    .poll(async () => {
      const [viewportBox, todayBox] = await Promise.all([
        scrollRegion.boundingBox(),
        todayCell.boundingBox(),
      ]);
      if (!viewportBox || !todayBox) return Number.POSITIVE_INFINITY;
      return Math.abs(
        todayBox.y + todayBox.height / 2 -
          (viewportBox.y + viewportBox.height / 2)
      );
    })
    .toBeLessThan(3);

  const headerBefore = await page.locator("header").boundingBox();
  const viewportBefore = await scrollRegion.boundingBox();
  await expandedToggle.click();
  await expect(
    page.getByRole("button", { name: collapsedLabel })
  ).toHaveAttribute("aria-expanded", "false");
  const headerAfter = await page.locator("header").boundingBox();
  const viewportAfter = await scrollRegion.boundingBox();
  if (!headerBefore || !headerAfter || !viewportBefore || !viewportAfter) {
    throw new Error("Layout desktop não renderizado");
  }
  expect(headerAfter.height).toBeLessThan(headerBefore.height);
  expect(viewportAfter.y).toBeLessThan(viewportBefore.y);

  await expect
    .poll(async () => {
      const [viewportBox, todayBox] = await Promise.all([
        scrollRegion.boundingBox(),
        todayCell.boundingBox(),
      ]);
      if (!viewportBox || !todayBox) return Number.POSITIVE_INFINITY;
      return Math.abs(
        todayBox.y + todayBox.height / 2 -
          (viewportBox.y + viewportBox.height / 2)
      );
    })
    .toBeLessThan(3);

  const centeredScrollTop = await scrollRegion.evaluate((node) => node.scrollTop);
  await scrollRegion.evaluate((node) => {
    node.scrollTop += 120;
  });
  await page.waitForTimeout(150);
  const manualScrollTop = await scrollRegion.evaluate((node) => node.scrollTop);
  expect(manualScrollTop).toBeGreaterThan(centeredScrollTop + 100);
  await page.waitForTimeout(150);
  expect(await scrollRegion.evaluate((node) => node.scrollTop)).toBe(manualScrollTop);

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

test("aplicação permanece interativa atrás do primeiro card", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "A jornada guiada começa no desktop"
  );
  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", { name: "Guia inicial do Doze 52" });
  await expect(panel).toBeVisible();

  const professional = page.locator(
    '[data-onboarding-profile-id][title="Profissional"]'
  );
  await professional.click();
  await expect(professional).toHaveAttribute("aria-pressed", "true");

  const firstCategory = page.locator("[data-onboarding-category-id]").first();
  const initialVisibility = await firstCategory.getAttribute("aria-pressed");
  await firstCategory.click();
  await expect(firstCategory).toHaveAttribute(
    "aria-pressed",
    initialVisibility === "true" ? "false" : "true"
  );

  await page.locator('[data-onboarding-profile-id][title="Pessoal"]').click();
  const demoEvent = page.getByRole("button", {
    name: "Feira gastronômica",
    exact: true,
  });
  await expect(demoEvent).toHaveAttribute("draggable", "true");
  const demoEventId = await demoEvent.getAttribute("data-calendar-event-id");
  await page.evaluate(
    ({ eventId, dateIso }) => {
      const source = document.querySelector<HTMLElement>(
        `[data-calendar-event-id="${eventId}"]`
      );
      const target = document.querySelector<HTMLElement>(
        `[data-day-cell][data-day-iso="${dateIso}"]`
      );
      if (!source || !target) throw new Error("Alvos do arraste não encontrados");
      const transfer = new DataTransfer();
      const rect = target.getBoundingClientRect();
      const eventInit = {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        dataTransfer: transfer,
      };
      source.dispatchEvent(new DragEvent("dragstart", eventInit));
      target.dispatchEvent(new DragEvent("dragover", eventInit));
      target.dispatchEvent(new DragEvent("drop", eventInit));
      source.dispatchEvent(new DragEvent("dragend", eventInit));
    },
    { eventId: demoEventId, dateIso: "2026-02-10" }
  );
  await expect
    .poll(() =>
      page.evaluate((eventId) => {
        const payload = JSON.parse(localStorage.getItem("yiv-store") ?? "{}");
        return payload.state?.events?.find(
          (event: { id: string }) => event.id === eventId
        )?.startDate;
      }, demoEventId)
    )
    .toBe("2026-02-10");
  await clickBehindGuidedPanel(
    page,
    page.getByRole("button", { name: "Feira gastronômica", exact: true })
  );
  const demoEventDialog = page.getByRole("dialog", { name: "Editar evento" });
  await expect(demoEventDialog.getByLabel("Título do evento")).toBeEnabled();
  await demoEventDialog.getByLabel("Título do evento").fill("Feira da cidade");
  await demoEventDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("button", { name: "Feira da cidade" })).toBeVisible();

  const themeControl = page.locator("[data-onboarding-theme-control]");
  await expect(themeControl).toBeEnabled();
  await themeControl.click();

  await panel.getByRole("button", { name: "Entrar na sua conta" }).click();
  await expect(page.getByRole("dialog", { name: "Entrar" })).toBeVisible();
});

test("edição preserva categoria não inicial no desktop e no mobile", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  await page.goto("/?mobileUi=0");
  await page.getByRole("button", { name: "Encerrar guia inicial" }).click();
  await page
    .getByRole("dialog", { name: "Quer encerrar a montagem guiada?" })
    .getByRole("button", { name: "Encerrar e explorar" })
    .click();

  const editedEventTitle = "Noite de fondue";
  const comparisonEventTitle = "Festival de verão";
  await page.evaluate(
    ({ editedEventTitle, comparisonEventTitle }) => {
      const today = new Date();
      const todayIso = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");
      const payload = JSON.parse(localStorage.getItem("yiv-store") ?? "{}");
      payload.state.categories = (payload.state.categories ?? []).map(
        (category: Record<string, unknown>) =>
          String(category.calendarPackGroupId ?? "").startsWith(
            "onboarding-personal-demo-"
          )
            ? {
                ...category,
                calendarPackGroupId: undefined,
                calendarPackVariantId: undefined,
                calendarPackCategoryKey: undefined,
                calendarPackVersion: undefined,
              }
            : category
      );
      payload.state.events = (payload.state.events ?? []).map(
        (event: Record<string, unknown>) => {
          const authorEvent = String(event.calendarPackGroupId ?? "").startsWith(
            "onboarding-personal-demo-"
          )
            ? {
                ...event,
                calendarPackGroupId: undefined,
                calendarPackEventKey: undefined,
              }
            : event;
          return event.title === editedEventTitle ||
            event.title === comparisonEventTitle
            ? { ...authorEvent, startDate: todayIso, endDate: todayIso }
            : authorEvent;
        }
      );
      localStorage.setItem("yiv-store", JSON.stringify(payload));
      localStorage.setItem(
        "doze52:onboarding:v2",
        JSON.stringify({
          version: 11,
          step: "completed",
          context: "personal",
          completedAt: new Date().toISOString(),
          postOnboardingEventsCreated: 0,
          postOnboardingCategoriesCreated: 0,
        })
      );
    },
    { editedEventTitle, comparisonEventTitle }
  );

  await page.goto(mobile ? "/?mobileUi=1" : "/?mobileUi=0");
  await page.locator('[data-onboarding-profile-id][title="Pessoal"]').click();

  const editedEvent = page.getByRole("button", {
    name: /Noite de fondue$/,
  });
  await expect(editedEvent).toBeVisible();
  const editedEventId = await editedEvent.getAttribute("data-calendar-event-id");
  if (!editedEventId) throw new Error("Evento de categoria Amigos sem ID");

  const before = await page.evaluate((eventId) => {
    const payload = JSON.parse(localStorage.getItem("yiv-store") ?? "{}");
    return payload.state.events.find(
      (event: { id: string }) => event.id === eventId
    ) as Record<string, unknown>;
  }, editedEventId);

  await editedEvent.click();
  let dialog = page.getByRole("dialog", { name: "Editar evento" });
  await expect(dialog.getByRole("combobox").nth(1)).toContainText("Amigos");
  await dialog.getByLabel("Descrição").fill("Descrição alterada isoladamente");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(() =>
      page.evaluate((eventId) => {
        const payload = JSON.parse(localStorage.getItem("yiv-store") ?? "{}");
        return payload.state.events.find(
          (event: { id: string }) => event.id === eventId
        ) as Record<string, unknown>;
      }, editedEventId)
    )
    .toMatchObject({ notes: "Descrição alterada isoladamente" });

  const persistedAfterDescription = await page.evaluate((eventId) => {
    const payload = JSON.parse(localStorage.getItem("yiv-store") ?? "{}");
    return payload.state.events.find(
      (event: { id: string }) => event.id === eventId
    ) as Record<string, unknown>;
  }, editedEventId);
  expect(persistedAfterDescription).toEqual({
    ...before,
    notes: "Descrição alterada isoladamente",
  });

  await page
    .getByRole("button", { name: /Festival de verão$/ })
    .click();
  dialog = page.getByRole("dialog", { name: "Editar evento" });
  await expect(dialog.getByRole("combobox").nth(1)).toContainText("Eventos");
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: /Noite de fondue$/ }).click();
  dialog = page.getByRole("dialog", { name: "Editar evento" });
  await dialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Eventos", exact: true }).click();
  await dialog.getByRole("button", { name: "Salvar" }).click();

  const expectedCategory = await page.evaluate(() => {
    const payload = JSON.parse(localStorage.getItem("yiv-store") ?? "{}");
    return payload.state.categories.find(
      (category: { name: string; profileId: string }, _index: number, categories: Array<{ name: string; profileId: string }>) =>
        category.name === "Eventos" &&
        category.profileId === categories.find((item) => item.name === "Amigos")?.profileId
    ) as { id: string; color: string };
  });
  await expect
    .poll(() =>
      page.evaluate((eventId) => {
        const payload = JSON.parse(localStorage.getItem("yiv-store") ?? "{}");
        const event = payload.state.events.find(
          (item: { id: string }) => item.id === eventId
        );
        return { categoryId: event?.categoryId, color: event?.color };
      }, editedEventId)
    )
    .toEqual({
      categoryId: expectedCategory.id,
      color: expectedCategory.color,
    });
});

test("o X libera o ano de exemplo e a decisão persiste após recarregar", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "O encerramento do guia acontece no desktop"
  );
  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  await panel.getByRole("button", { name: "Encerrar guia inicial" }).click();
  const exitDialog = page.getByRole("dialog", {
    name: "Quer encerrar a montagem guiada?",
  });
  await expect(exitDialog).toContainText(
    "O que você já criou continuará no seu ano"
  );
  await exitDialog
    .getByRole("button", { name: "Encerrar e explorar" })
    .click();
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
  expect(stored.profiles?.map((profile) => profile.name)).toEqual([
    "Pessoal",
    "Profissional",
  ]);
  expect(stored.categories).toHaveLength(13);
  expect(stored.events?.length).toBeGreaterThan(150);
  await expect(page.locator("[data-demo-mode-badge]")).toContainText(
    "Ano de exemplo"
  );

  await page.reload();
  await expect(panel).toBeHidden();
  await expect(page.locator("[data-guided-calendar-notice]")).toHaveCount(0);
  await expect(page.locator("[data-demo-mode-badge]")).toBeVisible();
});

test("saída após criar contexto preserva o ano e convida após três criações", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "O encerramento da montagem guiada acontece no desktop"
  );
  await page.goto("/?mobileUi=0");
  const panel = page.getByRole("region", { name: "Guia inicial do Doze 52" });
  await panel.getByRole("button", { name: /Pessoal/ }).click();
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_category_selection"
  );
  await panel.getByRole("button", { name: "Encerrar guia inicial" }).click();
  await page
    .getByRole("dialog", { name: "Quer encerrar a montagem guiada?" })
    .getByRole("button", { name: "Encerrar e explorar" })
    .click();
  await expect(panel).toBeHidden();

  await page.reload();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Pessoal", exact: true })).toBeVisible();
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(0);
  const persistedStep = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("doze52:onboarding:v2") ?? "null")
  );
  expect(persistedStep).toMatchObject({
    version: 11,
    step: "dismissed_preserved",
  });

  await page
    .getByRole("button", { name: "Editar contextos e categorias" })
    .click();
  for (const name of ["Saúde", "Família", "Projetos"]) {
    await page.getByRole("button", { name: "Criar nova categoria" }).click();
    const dialog = page.getByRole("dialog", { name: "Nova categoria" });
    await dialog.getByLabel("Nome da categoria").fill(name);
    await dialog.getByRole("button", { name: "Criar", exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(
    page.getByRole("complementary", { name: "Convite para guardar o ano" })
  ).toBeVisible();
});

test("substitui automaticamente um exemplo v3 ainda bloqueado", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Compatibilidade do armazenamento coberta no desktop"
  );
  await page.goto("/?mobileUi=0");
  await expect(
    page.locator('[data-onboarding-category-id][title="Viagens"]')
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const payload = JSON.parse(
          window.localStorage.getItem("yiv-store") ?? "{}"
        );
        return Boolean(payload.state?.categories?.length);
      })
    )
    .toBe(true);
  await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem("yiv-store") ?? "{}");
    payload.state.categories = (payload.state.categories ?? []).map(
      (category: Record<string, unknown>) => ({
        ...category,
        calendarPackGroupId: "onboarding-personal-demo-v3",
      })
    );
    payload.state.events = (payload.state.events ?? []).map(
      (event: Record<string, unknown>) => ({
        ...event,
        calendarPackGroupId: "onboarding-personal-demo-v3",
      })
    );
    window.localStorage.setItem("yiv-store", JSON.stringify(payload));
  });

  await page.reload();
  await expect(page.locator('[data-onboarding-category-id][title="Viagens"]')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const payload = JSON.parse(
          window.localStorage.getItem("yiv-store") ?? "{}"
        );
        return [
          ...new Set(
            [
              ...(payload.state.categories ?? []),
              ...(payload.state.events ?? []),
            ]
              .map(
                (item: { calendarPackGroupId?: string }) =>
                  item.calendarPackGroupId
              )
              .filter(Boolean)
          ),
        ].sort();
      })
    )
    .toEqual(
      [
        "formula-1-2026",
        "holidays-by-state",
        "onboarding-personal-demo-v7",
      ].sort()
    );
});

test("sandbox convida após cinco alvos e retoma o onboarding limpo", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  test.skip(mobile, "Entrada no sandbox coberta no desktop");
  await page.goto(mobile ? "/?mobileUi=1" : "/?mobileUi=0");
  await page
    .getByRole("button", { name: "Encerrar guia inicial" })
    .click();
  await page
    .getByRole("button", { name: "Encerrar e explorar" })
    .click();

  await page.locator('[data-onboarding-category-id][title="Família"]').click();
  await page.locator('[data-onboarding-category-id][title="Amigos"]').click();
  await page.locator('[data-onboarding-category-id][title="Viagens"]').click();
  await page.locator('[data-onboarding-profile-id][title="Profissional"]').click();
  await page.locator('[data-onboarding-category-id][title="Eventos"]').click();

  const invite = page.locator("[data-demo-exploration-invite]");
  await expect(invite).toContainText(
    "Agora, que tal montar o seu próprio ano?"
  );
  await invite
    .getByRole("button", { name: "Continuar explorando", exact: true })
    .click();
  await expect(invite).toBeHidden();

  await page.reload();
  await expect(invite).toBeVisible();
  await invite.getByRole("button", { name: "Criar meu ano" }).click();
  await expect(
    page.getByRole("region", { name: "Guia inicial do Doze 52" })
  ).toHaveAttribute("data-guided-onboarding-step", "context_selection");
  await expect(page.locator("[data-onboarding-profile-id]")).toHaveCount(2);
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(7);
});

test("centraliza cards e mantém a instrução visível no cabeçalho fixo", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  test.skip(mobile, "Os cards guiados não são exibidos no mobile");
  await page.goto(mobile ? "/?mobileUi=1" : "/?mobileUi=0");
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  const contextTitle = panel.getByRole("heading", {
    name: "Por qual contexto você quer começar?",
  });
  await expect(contextTitle).toHaveCSS("white-space", "nowrap");
  expect(
    await contextTitle.evaluate((node) => node.scrollWidth <= node.clientWidth)
  ).toBe(true);
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
  const filterSeparator = page.locator("[data-onboarding-filter-separator]");
  const [filterBox, overlayBox, noticeBox, separatorBox] = await Promise.all([
    filterRegion.boundingBox(),
    overlay.boundingBox(),
    noticeCard.boundingBox(),
    mobile ? Promise.resolve(null) : filterSeparator.boundingBox(),
  ]);
  if (!filterBox || !overlayBox || !noticeBox) {
    throw new Error("Sobreposição do cabeçalho não renderizada");
  }
  expect(Math.abs(filterBox.x - overlayBox.x)).toBeLessThan(1);
  expect(Math.abs(filterBox.width - overlayBox.width)).toBeLessThan(1);
  expect(noticeBox.width).toBeLessThan(overlayBox.width);
  if (mobile) {
    expect(Math.abs(filterBox.y - overlayBox.y)).toBeLessThanOrEqual(1.1);
    expect(Math.abs(filterBox.height - overlayBox.height)).toBeLessThanOrEqual(
      1.1
    );
  } else {
    if (!separatorBox) {
      throw new Error("Separador inferior dos filtros não renderizado");
    }
    const overlayBottom = overlayBox.y + overlayBox.height;
    const noticeBottom = noticeBox.y + noticeBox.height;
    expect(overlayBox.y).toBeGreaterThan(filterBox.y);
    expect(overlayBottom).toBeLessThan(separatorBox.y);
    expect(noticeBox.y).toBeGreaterThan(filterBox.y);
    expect(noticeBottom).toBeLessThan(separatorBox.y);
    expect(noticeBox.y - filterBox.y).toBeGreaterThanOrEqual(4);
    expect(separatorBox.y - noticeBottom).toBeGreaterThanOrEqual(4);
  }
  const filterControls = filterRegion.locator(":scope > div").first();
  await expect(filterControls).toHaveAttribute("inert", "");
  await expect(filterControls).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("[data-onboarding-edit-control]")).toBeEnabled();
  await expect(page.locator("[data-onboarding-calendar-control]")).toBeEnabled();
  await expect(page.locator("[data-onboarding-year-control]")).toBeEnabled();
  await expect(page.locator("[data-onboarding-theme-control]")).toBeEnabled();
  const noticeTitleFontSize = await notice
    .locator("p")
    .first()
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(noticeTitleFontSize).toBeGreaterThanOrEqual(16);
  if (!mobile) {
    const scrollRegion = page.locator("[data-desktop-calendar-scroll-region]");
    await scrollRegion.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(notice).toBeVisible();
    const noticeBoxAfterScroll = await notice.boundingBox();
    const viewport = page.viewportSize();
    if (!noticeBoxAfterScroll || !viewport) {
      throw new Error("Orientação fixa não renderizada");
    }
    expect(noticeBoxAfterScroll.y).toBeGreaterThanOrEqual(0);
    expect(noticeBoxAfterScroll.y + noticeBoxAfterScroll.height).toBeLessThanOrEqual(
      viewport.height
    );
  }
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
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  await panel.getByRole("button", { name: /Pessoal/ }).click();
  await panel.getByRole("button", { name: /Aniversários/ }).click();
  await panel.getByRole("button", { name: "Criar categoria" }).click();
  const revealedCategory = page.locator(
    '[data-onboarding-category-id][data-onboarding-highlight-effect="reveal"]'
  );
  await expect(revealedCategory).toHaveCSS("animation-name", "none");
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
  await expect(panel).toContainText(
    "Para acompanhar projetos, compromissos e conquistas."
  );
  await panel.getByRole("button", { name: /Profissional/ }).click();
  await expect(panel).toContainText("O que você quer tornar visível primeiro?");
  await expect(panel).toContainText(
    "Seu contexto Profissional está pronto. Comece por uma entrega ou por uma data importante do seu trabalho."
  );
  await expect(panel).not.toContainText(/aniversário/i);
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
  await expect(page.locator("[data-guided-calendar-notice]")).toContainText(
    "Adicione uma data importante do seu trabalho."
  );
  await expect(page.locator("[data-guided-calendar-notice]")).not.toContainText(
    /aniversário|férias/i
  );

  await page.evaluate(() => {
    const current = JSON.parse(
      window.localStorage.getItem("doze52:onboarding:v2") ?? "{}"
    );
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({
        ...current,
        version: 11,
        step: "period_category_selection",
        dateItemsCreated: 2,
        categoryRevealStartedAt: undefined,
      })
    );
  });
  await page.reload();
  await expect(panel).toContainText("Quais períodos você quer tornar visíveis?");
  await expect(panel).toContainText(
    "Projetos e outros períodos importantes mostram como seu trabalho se distribui ao longo do ano."
  );
  await expect(panel).not.toContainText(/férias|viagens/i);
  await panel.getByRole("button", { name: /Projetos/ }).click();
  await panel.getByRole("button", { name: "Criar categoria" }).click();
  await expect(page.locator("[data-guided-calendar-notice]")).toContainText(
    "Adicione um projeto importante."
  );
  await expect(page.locator("[data-guided-calendar-notice]")).not.toContainText(
    /férias|viagens/i
  );
});
