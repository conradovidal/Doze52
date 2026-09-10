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

const completePersonalOnboarding = async (
  page: Page,
  mobile: boolean
) => {
  if (!mobile) {
    // A coluna de nomes dos hábitos (e o "+" de criar) só renderiza com
    // rótulo acessível a partir de ~1440px — abaixo disso ela colapsa para
    // ícones sem nome (ver tests/habits-e2e/habits-navigation.spec.ts, que
    // roda só nos projetos desktop-1024/1440 por esse motivo). Ajustado no
    // início da jornada, antes de qualquer medição de layout, para não
    // misturar duas larguras de viewport na mesma passagem.
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  const panel = page.getByRole("region", {
    name: "Guia inicial do Doze 52",
  });
  // :visible porque a nav adaptativa mantém uma instância mobile (md:hidden)
  // e uma desktop do aviso no DOM ao mesmo tempo em telas mais largas — só
  // uma fica realmente visível.
  const toolbarNotice = page.locator("[data-guided-toolbar-notice]:visible");
  await panel.getByRole("button", { name: /Pessoal/ }).click();
  await expect(panel).toHaveAttribute(
    "data-guided-onboarding-step",
    "date_category_selection"
  );
  await expect(panel.locator("[data-category-color-swatch]")).toHaveCount(9);
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
  // Cor padrão de "Datas importantes" é TERRA (ver
  // getOnboardingCategoryDefinition em lib/store.ts), incluída em
  // ONBOARDING_QUICK_COLORS justamente para a amostra já vir marcada aqui.
  await expect(
    panel.locator('[data-category-color-swatch][data-color="#D6A060"]')
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    genericChoice.locator("[data-onboarding-category-color-indicator]")
  ).toHaveCSS("background-color", "rgb(214, 160, 96)");
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
  // A "revelação" da categoria roda numa animação cronometrada antes de
  // liberar o passo seguinte (date_instruction) — sem esperar por ela aqui,
  // um clique no dia ainda cai em date_category_reveal e abre um evento
  // "normal" (fora do fluxo guiado), em vez do date_details esperado.
  await expect(page.locator("[data-guided-calendar-notice]")).toBeVisible();
  await expect(
    page.locator("[data-guided-calendar-notice]")
  ).toHaveAttribute("data-guided-selection-mode", "date");
  await expect(
    page.locator('[data-onboarding-category-id][title="Aniversários"]')
  ).not.toHaveAttribute("data-onboarding-highlighted", "true");

  // A criação de datas/períodos guiados agora usa o diálogo oficial de
  // evento ("Novo evento") em vez de um campo embutido no card grande — o
  // card grande (panel) fica escondido durante date_instruction/date_details,
  // e quem carrega o passo é o aviso compacto (data-guided-calendar-notice).
  const eventDialog = page.getByRole("dialog", { name: "Novo evento" });

  await selectGuidedDate(page, mobile, "2026-02-10");
  await expect(eventDialog).toBeVisible();
  await eventDialog.getByLabel("Título do evento").fill("Aniversário da mãe");
  await eventDialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(eventDialog).toBeHidden();
  await expect(
    page.locator("[data-guided-calendar-notice]")
  ).toContainText(/mais alguém/i);

  await selectGuidedDate(page, mobile, "2026-09-12");
  await expect(eventDialog).toBeVisible();
  await eventDialog.getByLabel("Título do evento").fill("Aniversário do pai");
  await eventDialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(eventDialog).toBeHidden();

  // O passo de períodos ("Férias e viagens") foi removido do tour guiado —
  // dois exemplos de período já vêm prontos no ano de exemplo, então o
  // guia segue direto de datas para visibilidade (ver commit "Refina
  // onboarding guiado", #95, e a remoção de period_category_selection do
  // fluxo normal em lib/onboarding.ts).
  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "visibility"
  );
  await toolbarNotice.getByRole("button", { name: "Continuar" }).click();

  // O Anual entra entre a prática de criação e o modo de edição.
  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "year"
  );
  await toolbarNotice.getByRole("button", { name: "Continuar" }).click();

  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "edit"
  );
  const spotlightToolbar = page.locator(
    '[data-onboarding-toolbar-spotlight="true"]:visible'
  );
  const editControl = mobile
    ? page.locator("[data-onboarding-edit-control]")
    : page.locator('[data-product-organize="desktop"]');
  const editingLabel = mobile ? /Finalizar edição/ : /Finalizar organização/;
  const notEditingLabel = mobile ? /^Editar$/ : /^Organizar$/;
  await expect(editControl).toBeEnabled();
  await expect(toolbarNotice).toContainText(
    "Organize contextos e categorias."
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
  const adaptiveDesktop =
    !mobile &&
    (await page.locator('[data-product-navigation="desktop"]').isVisible());
  expect(editNoticeBox.width).toBeLessThanOrEqual(352.5);
  expect(editNoticeBox.x).toBeGreaterThanOrEqual(-0.5);
  expect(editNoticeBox.x + editNoticeBox.width).toBeLessThanOrEqual(
    viewport.width + 0.5
  );
  if (adaptiveDesktop) {
    await expect(toolbarNotice).toHaveCSS("position", "fixed");
    expect(
      await toolbarNotice.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
        return Boolean(hit && element.contains(hit));
      })
    ).toBe(true);
  }
  await expect(
    toolbarNotice.getByRole("button", { name: "Encerrar guia inicial" })
  ).toHaveCSS("position", "absolute");
  await editControl.click();
  // No nav adaptativa (desktop), "Organizar" abre um diálogo modal com as
  // categorias — não mais o painel de filtros embutido que se expandia
  // inline (esse formato ainda existe fora da nav adaptativa/no mobile).
  if (!adaptiveDesktop) {
    const filterRegion = page.locator("[data-onboarding-filter-region]");
    await expect(filterRegion.locator(":scope > div").first()).not.toHaveAttribute(
      "inert",
      ""
    );
  }
  const beforeEditPreview = await page.evaluate(() =>
    window.localStorage.getItem("yiv-store")
  );
  const finishEdit = editControl;
  if (!adaptiveDesktop) {
    await expect(finishEdit).toHaveAttribute("aria-label", editingLabel);
  }
  if (adaptiveDesktop) {
    await expect(toolbarNotice).toHaveAttribute(
      "data-guided-toolbar-target",
      "calendars"
    );
  } else {
    await expect(toolbarNotice).toContainText("Este é o modo de edição");
    await finishEdit.click();
  }
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
    "Use o + para abrir as opções e escolher um calendário."
  );
  const calendarControl = page.locator("[data-onboarding-calendar-control]");
  if (!mobile && await page.locator('[data-product-navigation="desktop"]').isVisible()) {
    const calendarNoticeBox = await toolbarNotice.boundingBox();
    const calendarControlBox = await calendarControl.boundingBox();
    if (!calendarNoticeBox || !calendarControlBox) {
      throw new Error("Balão de calendários não foi ancorado ao botão +");
    }
    expect(
      Math.abs(
        calendarNoticeBox.x + calendarNoticeBox.width / 2 -
          (calendarControlBox.x + calendarControlBox.width / 2)
      )
    ).toBeLessThan(28);
  }
  await calendarControl.click();
  const categoryDialog = page.getByRole("dialog", { name: "Adicionar categoria" });
  if (await categoryDialog.isVisible()) {
    await categoryDialog
      .getByRole("button", { name: /Adicionar calendário pronto/ })
      .click();
  }
  // O diálogo de destino deixou de ser específico por pacote ("Adicione os
  // feriados do seu estado") — agora é um único diálogo "Calendários" com
  // todos os pacotes prontos listados lado a lado.
  const calendarsDialog = page.getByRole("dialog", { name: "Calendários" });
  await expect(calendarsDialog).toBeVisible();
  await expect(calendarsDialog).toContainText(
    "Feriados do seu estado é uma boa sugestão para começar"
  );
  const calendarCards = calendarsDialog.locator("[data-calendar-pack-group]");
  await expect(calendarCards.first()).toBeVisible();
  expect(await calendarCards.count()).toBeGreaterThan(1);
  const stateSelect = calendarsDialog.getByRole("combobox", {
    name: /Estado para Feriados nacionais/i,
  });
  await expect(stateSelect).toHaveText(/São Paulo \(SP\)/i);
  await calendarsDialog
    .getByRole("button", { name: "Adicionar feriados", exact: true })
    .click();
  await expect(calendarsDialog).toBeHidden();
  if (adaptiveDesktop) {
    await expect(editControl).toHaveAttribute("aria-label", notEditingLabel);
  }
  const importedHolidayTitles = await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem("yiv-store") ?? "{}");
    return (payload.state?.events ?? []).map(
      (event: { title?: string }) => event.title
    );
  });
  expect(importedHolidayTitles).toContain("9 de Julho — Data Magna de São Paulo");
  expect(importedHolidayTitles).not.toContain("Revolução Farroupilha");

  // No desktop, o guia agora também apresenta a navegação por período e um
  // convite para criar o primeiro hábito antes do tema — a "vitrine de
  // hábitos" deixou de ser um recurso em prototipagem (feature flag
  // removida, ver lib/feature-flags.ts) e passou a fazer parte do fluxo
  // padrão sempre que showHabitSteps é true (isMobileCalendarUi !== true).
  if (!mobile) {
    await expect(toolbarNotice).toHaveAttribute(
      "data-guided-toolbar-target",
      "period-navigation"
    );
    await toolbarNotice.getByRole("button", { name: "Continuar" }).click();

    await expect(toolbarNotice).toHaveAttribute(
      "data-guided-toolbar-target",
      "habit-surface"
    );
    await page
      .locator('[data-product-navigation="desktop"] [data-product-destination="habits"]')
      .click();

    await expect(toolbarNotice).toHaveAttribute(
      "data-guided-toolbar-target",
      "habit"
    );
    // A vitrine de hábitos (Exercício, Ler 20 minutos) monta/anima ao entrar
    // em Hábitos — sem esperar por ela, o "+" ainda não tem o aria-label
    // certo e o clique não abre o formulário de criação.
    await expect(
      page.getByRole("button", { name: "Exercício", exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Criar novo hábito" }).click();
    await page.getByLabel("Nome do hábito").fill("Leitura");
    await page.getByRole("button", { name: "Criar hábito" }).click();

    const habitCreatedNotice = page.locator(
      '[data-guided-toolbar-notice][data-guided-toolbar-target="habit-created"]:visible'
    );
    await expect(habitCreatedNotice).toBeVisible();
    await habitCreatedNotice.getByRole("button", { name: "Continuar" }).click();
  }

  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "theme"
  );
  // O wrapper data-onboarding-toolbar-spotlight só existe na barra de
  // ferramentas compacta (md:hidden) do modo não-adaptativo — na nav
  // adaptativa (desktop), o destaque do tema é aplicado direto no controle
  // via a classe product-spotlight-target, checada abaixo.
  if (!adaptiveDesktop) {
    const themeTarget = spotlightToolbar.locator(
      '[data-onboarding-spotlight-target="true"]'
    );
    await expect(themeTarget).toBeVisible();
  }
  // A navegação adaptativa mantém uma instância mobile (md:hidden) e uma
  // desktop com o mesmo atributo, alternadas por CSS — só uma fica visível.
  const visibleThemeControl = page.locator(
    "[data-onboarding-theme-control]:visible"
  );
  await expect(visibleThemeControl).toHaveClass(/product-spotlight-target/);
  expect(
    await visibleThemeControl.evaluate(
      (node) => getComputedStyle(node).backgroundColor
    )
  ).not.toBe("rgba(0, 0, 0, 0)");
  if (!adaptiveDesktop) {
    await expect(
      spotlightToolbar
        .locator(':scope > :not([data-onboarding-spotlight-target="true"])')
        .first()
    ).toHaveCSS("opacity", "0.48");
  }
  await expect(
    toolbarNotice.locator("[data-guided-toolbar-arrow]")
  ).toHaveCount(0);
  await visibleThemeControl.click();
  await visibleThemeControl.click();
  // O botão de ação do passo de tema só aparece depois que o tema é
  // confirmado (guidedOnboarding.themeConfirmedAt) — ver getGuidedToolbarNotice
  // em app/page.tsx.
  await toolbarNotice.getByRole("button", { name: "Continuar" }).click();

  await expect(toolbarNotice).toHaveAttribute(
    "data-guided-toolbar-target",
    "wrap-up"
  );
  // Na nav adaptativa, o resumo final (wrap_up_instruction) não tem ação no
  // aviso flutuante — a pessoa precisa abrir o Organizar para ver o que já
  // construiu, e é lá dentro que "Finalizar guia" aparece (ver
  // getGuidedToolbarNotice em app/page.tsx: actionLabel só existe quando
  // inlineEditModeActive, o que não é o caso na nav adaptativa).
  if (adaptiveDesktop) {
    await editControl.click();
  }
  const finishGuideButton = page.getByRole("button", { name: "Finalizar guia" });
  await expect(finishGuideButton).toBeVisible();
  await finishGuideButton.click();
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
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(4);
  await expect(page.locator("[data-onboarding-connector]")).toHaveCount(0);
  await expect(panel).toContainText(
    "Por qual contexto você quer começar?"
  );
  await expect(panel).toContainText("Dá para alternar entre eles depois.");
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
    version: 15,
    step: "completed",
    context: "personal",
  });
  expect(stored.store?.state?.profiles?.[0]?.name).toBe("Pessoal");
  expect(stored.store?.state?.categories?.map((item) => item.name)).toEqual([
    "Aniversários",
    "Feriados",
  ]);
  expect(stored.store?.state?.categories?.[0]?.color).toBe("#EF8F8F");
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
  // 1 de 8 passos (não mais 7, ver #95) — 1/8 arredonda para 13, não 14.
  await expect(onboardingProgress).toHaveAttribute("aria-valuenow", "13");

  await completePersonalOnboarding(page, false);

  // O seletor de escala (radiogroup Trimestre/Mês/Ano) saiu da Anual junto
  // com a flag de Hábitos prototype (isHabitsPrototypeEnabled não existe
  // mais em lib/feature-flags.ts — Hábitos virou permanente e
  // `showScaleControl` passou a ser sempre false). Trocar de escala agora é
  // clicar direto no rótulo do trimestre/mês, como o resto do produto já
  // faz (ver handleQuarterRailClick/handleMonthLabelClick em
  // year-grid.tsx) — o zoom em si (`hasFocusZoom = viewMode !== "year"`)
  // não foi afetado por essa remoção.
  const monthIndex = new Date().getMonth();
  const quarterIndex = Math.floor(monthIndex / 3);
  const quarterLabel = `${quarterIndex + 1}o trimestre`;
  const monthTitleLabel = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ][monthIndex];

  await page.getByRole("button", { name: `Abrir ${quarterLabel}` }).click();
  const zoomControl = page.getByLabel("Zoom do calendário");
  await expect(zoomControl).toBeVisible();
  await zoomControl.press("Home");
  const focusedMonthRow = page.locator(`[data-month-row="${monthIndex}"]`);
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
  await page.getByRole("button", { name: `Abrir ${monthTitleLabel}` }).click();
  const currentMonthLabel = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ][monthIndex];
  await expect(
    page.getByRole("button", { name: /Voltar para .* trimestre/ })
  ).toHaveText(currentMonthLabel);
  // Sem o seletor, voltar de mês para ano é dois cliques (mês→trimestre,
  // trimestre→ano), não um só.
  await page
    .getByRole("button", { name: `Voltar para ${quarterLabel}` })
    .click();
  await page
    .getByRole("button", {
      name: `Voltar para o ano inteiro a partir de ${quarterLabel}`,
    })
    .click();
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
  // A jornada de Hábitos no mobile (lib/mobile-habits-onboarding.ts) é
  // independente do que foi testado no desktop acima — sem isto, o card
  // "Passo 1 de 8" cobriria a tela e bloquearia o "Novo evento" abaixo.
  await page.evaluate(() => {
    localStorage.setItem("doze52:mobile-habits-onboarding:v1", "dismissed");
  });
  // Perfis/eventos são conceito da Anual — no mobile, "surface" cai em
  // Hábitos por padrão (ver resolveInitialProductDestination).
  await page.goto("/?mobileUi=1&surface=annual");
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
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?mobileUi=0");
  await page
    .getByRole("region", { name: "Guia inicial do Doze 52" })
    .getByRole("button", { name: "Encerrar guia inicial" })
    .click();
  await page.getByRole("button", { name: "Encerrar e explorar" }).click();

  // O botão dedicado de calendários no cabeçalho saiu com a navegação
  // adaptativa (#97) — hoje "Adicionar calendário pronto" mora dentro do
  // fluxo "Adicionar categoria" (CategoryCreationFlow), alcançado por
  // Organizar → aba Categorias → escolher o contexto → "Nova categoria".
  // Como `onImported` fecha o diálogo inteiro (CategoryCreationFlow), cada
  // pacote precisa reabrir esse caminho — não dá pra importar os dois numa
  // única passagem pelo diálogo.
  const openCalendarPacks = async () => {
    const organizeDialog = page.getByRole("dialog", { name: "Organizar" });
    // `onImported` fecha só o CategoryCreationFlow — o painel Organizar por
    // baixo permanece aberto (com a aba/contexto já selecionados) entre uma
    // importação e outra.
    if (!(await organizeDialog.isVisible())) {
      await page.getByRole("button", { name: "Organizar" }).click();
      await expect(organizeDialog).toBeVisible();
    }
    const categoriesTab = organizeDialog.getByRole("button", {
      name: "Categorias",
    });
    if ((await categoriesTab.count()) && (await categoriesTab.getAttribute("aria-pressed")) !== "true") {
      await categoriesTab.click();
    }
    const contextSelect = organizeDialog.getByRole("combobox").first();
    if ((await contextSelect.count()) && (await contextSelect.innerText()) !== "Pessoal") {
      await contextSelect.click();
      await page.getByRole("option", { name: "Pessoal" }).click();
    }
    await organizeDialog.getByRole("button", { name: "Nova categoria" }).click();
    await page
      .getByRole("dialog", { name: "Adicionar categoria" })
      .getByRole("button", { name: "Adicionar calendário pronto" })
      .click();
    const calendarDialog = page.getByRole("dialog", { name: "Calendários" });
    await expect(calendarDialog).toBeVisible();
    return calendarDialog;
  };
  const importPack = async (card: Locator) => {
    // Com `fixedTargetProfileId` (chegando pelo fluxo de categoria, já com
    // o contexto fixado), o card já nasce expandido — "Adicionar
    // calendário" é o próprio botão de confirmação, não um passo de abrir.
    await card.getByRole("button", { name: "Adicionar calendário" }).click();
    await expect(card).toBeHidden();
  };
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
  let dialog = await openCalendarPacks();
  {
    // O padrão de estado do card não é necessariamente RS (isso só valia
    // para a semente antiga do ano de exemplo, #95) — escolhe explicitamente
    // para o resto do teste (troca RS→SP) fazer sentido.
    const card = dialog.locator('[data-calendar-pack-group="holidays-by-state"]');
    await card
      .getByRole("combobox", { name: /Estado para Feriados nacionais/i })
      .click();
    await page.getByRole("option", { name: /Rio Grande do Sul \(RS\)/i }).click();
    await importPack(card);
  }
  dialog = await openCalendarPacks();
  await importPack(
    dialog.locator('[data-calendar-pack-group="formula-1-2026"]')
  );
  dialog = await openCalendarPacks();
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
  dialog = await openCalendarPacks();
  const reopenedHolidayCard = dialog.locator(
    '[data-calendar-pack-group="holidays-by-state"]'
  );
  await expect(
    reopenedHolidayCard.getByRole("combobox", {
      name: /Estado para Feriados nacionais/i,
    })
  ).toHaveText(/São Paulo \(SP\)/i);
  await reopenedHolidayCard.getByRole("button", { name: "Remover" }).click();
  await page.keyboard.press("Escape");
  await page.reload();
  await waitForHolidayVariant(null);
  await expect(
    page.getByRole("button", { name: "Feriados", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Corridas F1", exact: true })
  ).toBeVisible();
  await openCalendarPacks();
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
  // "Organizar" abre um painel modal, não mais um modo inline com um botão
  // "Finalizar organização" para alternar de volta (#94) — cada categoria
  // tem seu próprio ícone de lápis ("Editar categoria X"), que já é o mesmo
  // aria-label usado abaixo.
  const editWorkspace = page.getByRole("button", { name: "Organizar" });
  const organizeDialog = page.getByRole("dialog", { name: "Organizar" });
  await expect(async () => {
    await editWorkspace.click();
    await expect(organizeDialog).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 10_000 });
  await organizeDialog
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
  // "Aniversários" não é mais pré-seedado no ano de exemplo (#95) — é uma
  // categoria que o guia ensina a pessoa a criar por conta própria.
  await page.getByRole("option", { name: "Amigos · Pessoal" }).click();
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

test("mobile trava a Anual até a jornada de Hábitos terminar", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "Entrada desktop-first validada no viewport mobile"
  );

  // Um link direto para `?surface=annual` não vale para quem nunca passou
  // pela jornada de Hábitos — ela é redirecionada de volta, mesmo por URL.
  await page.goto("/?mobileUi=1&surface=annual");
  await expect(page.locator("[data-habits-prototype]")).toBeVisible();
  await expect(page.locator("[data-mobile-calendar-experience]")).toHaveCount(
    0
  );
  // O botão de debug "Reiniciar onboarding" (só em dev/teste) fica fixo no
  // mesmo canto inferior esquerdo do link Anual da navegação e intercepta o
  // clique real do navegador nesta largura — tira do caminho para o teste.
  await page.getByRole("button", { name: "Reiniciar onboarding" }).evaluate(
    (button) => {
      (button as HTMLElement).style.pointerEvents = "none";
    }
  );
  // O indicador de dev do Next.js (aviso "Supabase não configurado" neste
  // ambiente sem env vars) cria um portal fixo no canto inferior esquerdo,
  // sobrepondo a mesma região — mesmo tratamento do botão acima.
  await page.evaluate(() => {
    const portal = document.querySelector("nextjs-portal");
    if (portal instanceof HTMLElement) portal.style.pointerEvents = "none";
  });

  const habitCard = page.locator("[data-guided-toolbar-notice]");
  const annualNav = page.locator(
    'nav[data-product-navigation="mobile"] a[data-product-destination="annual"]'
  );

  // Passo 1: abertura ("Isto é o Doze 52 no celular"), com "Continuar" —
  // a contagem é única do intro ao Perfil (1 de 8), não mais dividida em
  // duas jornadas de 3 e 4 (ver getMobileHabitsOnboardingStepLabel).
  await expect(habitCard).toContainText("Passo 1 de 8");
  await habitCard.getByRole("button", { name: "Continuar" }).click();

  // Passo 2: o "+" já vem destacado, sem outro "Continuar" no meio do caminho.
  await expect(habitCard).toContainText("Passo 2 de 8");
  await expect(habitCard).toContainText("Assim funcionam os hábitos.");
  await expect(annualNav).toHaveAttribute("aria-disabled", "true");
  await page
    .locator('[data-habits-prototype] button[aria-label="Criar novo hábito"]')
    .click();
  await page.getByLabel("Nome do hábito").fill("Beber água");
  await page.getByRole("button", { name: "Criar hábito" }).click();

  // Passo 2: avança sozinho ao criar; ainda travada na Anual.
  await expect(habitCard).toContainText("Passo 3 de 8");
  await expect(annualNav).toHaveAttribute("aria-disabled", "true");
  await page
    .locator('[data-habits-prototype] button[aria-pressed="false"]:not([disabled])')
    .last()
    .click();

  // Passo 3: avança sozinho ao marcar; a Anual libera e é o próprio alvo
  // apontado pelo card.
  await expect(habitCard).toContainText("Passo 4 de 8");
  await expect(habitCard).toContainText("Isto é Hábitos.");
  await expect(annualNav).not.toHaveAttribute("aria-disabled", "true");

  await annualNav.click();
  await expect(page).toHaveURL(/surface=annual/);
  await expect(page.locator("[data-mobile-calendar-experience]")).toBeVisible();
  await expect(
    page.locator("[data-calendar-event-id]").first()
  ).toBeVisible();

  // A jornada continua na Anual: ano (que já ensina o atalho de voltar a
  // hoje, num só passo), tema, organizar, e por fim o Perfil — mesmo card
  // reaproveitado, sem toque de "Continuar" só no último (a pessoa toca no
  // botão real).
  const yearLabel = page.locator(
    '[data-onboarding-year-control] button[title="Ir para hoje"]'
  );
  const initialYearText = await yearLabel.textContent();

  await expect(habitCard).toContainText("Passo 5 de 8");
  await expect(habitCard).toContainText("Aqui você troca o ano.");
  await expect(habitCard).toContainText("voltar direto a hoje");
  await page
    .locator('[data-onboarding-year-control] button[aria-label^="Voltar"]')
    .click();
  await expect(yearLabel).not.toHaveText(initialYearText ?? "");
  // "Continuar" aqui não é só avançar passo: já demonstra o atalho que o
  // card acabou de explicar, voltando o ano para hoje sozinho.
  await habitCard.getByRole("button", { name: "Continuar" }).click();
  await expect(yearLabel).toHaveText(initialYearText ?? "");

  await expect(habitCard).toContainText("Passo 6 de 8");
  await expect(habitCard).toContainText("Escolha o clima do seu ano.");
  await habitCard.getByRole("button", { name: "Continuar" }).click();

  await expect(habitCard).toContainText("Passo 7 de 8");
  await expect(habitCard).toContainText("Organize contextos e categorias.");
  await habitCard.getByRole("button", { name: "Continuar" }).click();

  await expect(habitCard).toContainText("Passo 8 de 8");
  await expect(habitCard).toContainText("Guarde esse ano com você.");
  await expect(
    habitCard.getByRole("button", { name: "Continuar" })
  ).toHaveCount(0);

  // Último passo: sem botão no card — toca no Perfil de verdade, que abre o
  // painel de conta já em Cadastro e encerra a jornada.
  await page
    .locator('nav[data-product-navigation="mobile"] [data-onboarding-auth-entry]')
    .click();
  const accountPanel = page.getByRole("dialog", {
    name: "Conta e configurações",
  });
  await expect(accountPanel).toBeVisible();
  await expect(
    accountPanel.getByRole("button", { name: "Cadastro" })
  ).toHaveClass(/bg-background/);
  await accountPanel.getByRole("button", { name: "Close" }).click();
  await expect(habitCard).toHaveCount(0);

  const mobileStepAfterProfile = await page.evaluate(() =>
    window.localStorage.getItem("doze52:mobile-habits-onboarding:v1")
  );
  expect(mobileStepAfterProfile).toBe("completed");

  // A faixa da Anual reaparece agora com a variante de quem acabou de
  // terminar a jornada inteira.
  const notice = page.locator("[data-mobile-desktop-first-notice]");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Um gostinho do Anual.");

  await notice.getByRole("button", { name: "Entrar na minha conta" }).click();
  const authDialog = page.getByRole("dialog", { name: "Entrar" });
  await expect(authDialog).toBeVisible();
  // Quem terminou a jornada de Hábitos ainda não tem conta — abre direto em
  // Cadastro, não em Login.
  await expect(
    authDialog.getByRole("heading", { name: "Criar conta", exact: true })
  ).toBeVisible();
  await authDialog.getByRole("button", { name: "Cancelar" }).click();

  await notice.getByRole("button", { name: "Dispensar" }).click();
  await expect(notice).toHaveCount(0);

  const persisted = await page.evaluate(() => ({
    noticeDismissed: window.localStorage.getItem(
      "doze52:mobile-desktop-first-notice:dismissed"
    ),
    mobileHabitsStep: window.localStorage.getItem(
      "doze52:mobile-habits-onboarding:v1"
    ),
  }));
  expect(persisted.noticeDismissed).toBe("true");
  expect(persisted.mobileHabitsStep).toBe("completed");

  await page.reload();
  await expect(notice).toHaveCount(0);
  await expect(page.locator("[data-mobile-calendar-experience]")).toBeVisible();

  // Quem já criou um hábito de verdade pela jornada do mobile não deve ver o
  // guia completo do desktop de novo ao abrir por lá: `hasExistingHabits`
  // entra em `hasEstablishedSetup`, que já desativa `guidedOnboardingEligible`
  // fora de uma sessão em progresso.
  await page.goto("/?mobileUi=0");
  await expect(
    page.getByRole("region", { name: "Guia inicial do Doze 52" })
  ).toHaveCount(0);
});

test("mobile preserva progresso parcial e recomenda continuar no desktop", async ({
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

  await page.goto("/?mobileUi=1&surface=annual");
  const notice = page.locator("[data-mobile-desktop-first-notice]");
  await expect(notice).toContainText("Continue no desktop.");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("body")).toHaveCSS("pointer-events", "auto");
  await expect(panel).toHaveCount(0);

  const persisted = await page.evaluate(() => ({
    noticeDismissed: window.localStorage.getItem(
      "doze52:mobile-desktop-first-notice:dismissed"
    ),
    onboarding: JSON.parse(
      window.localStorage.getItem("doze52:onboarding:v2") ?? "null"
    ) as { step?: string } | null,
  }));
  expect(persisted.noticeDismissed).toBeNull();
  expect(persisted.onboarding?.step).toBe("date_category_selection");
});

test("categorias recolhidas liberam espaço e recentralizam hoje", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  test.skip(mobile, "Comportamento do cabeçalho coberto no desktop");
  // A alternância de categorias (branch desktop com navegação adaptativa)
  // só começa expandida por padrão em telas altas — `min-height: 900px` em
  // components/app-header.tsx, adicionado no PR #97 — enquanto o teste é de
  // 2023/#47, anterior a essa regra.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(mobile ? "/?mobileUi=1" : "/?mobileUi=0");

  await page
    .getByRole("button", { name: "Encerrar guia inicial" })
    .click();
  await page
    .getByRole("button", { name: "Encerrar e explorar" })
    .click();

  // "Recolher/Mostrar categorias" (o chevron dentro da linha de categorias)
  // só encolhe a LARGURA da fileira de chips — quem de fato libera altura
  // do cabeçalho é o botão dedicado "Minimizar contextos e categorias"
  // (components/navigation/adaptive-navigation.tsx, ligado a
  // `headerMinimized`), com aria-pressed em vez de aria-expanded.
  const expandedLabel = mobile
    ? "Recolher contextos e categorias"
    : "Minimizar contextos e categorias";
  const collapsedLabel = "Mostrar contextos e categorias";
  const expandedToggle = page.getByRole("button", { name: expandedLabel });
  if (mobile) {
    await expect(expandedToggle).toHaveAttribute("aria-expanded", "true");
  } else {
    await expect(expandedToggle).toHaveAttribute("aria-pressed", "false");
  }

  const scrollRegion = page.locator("[data-desktop-calendar-scroll-region]");
  const currentDateIso = await page.evaluate(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  });
  // Em telas altas o ano de 12 meses cabe quase inteiro sem rolar (pouca
  // folga entre scrollHeight e clientHeight) — se o alvo de centralização
  // exceder essa folga, o próprio app limita o scroll ao máximo possível
  // (`Math.max(0, nextScrollTop)` em app/page.tsx), então "centralizado"
  // aqui significa "no ponto ideal, respeitado esse limite", não
  // necessariamente no meio exato do viewport.
  const expectTodayScrolledAsCenteredAsPossible = () =>
    expect
      .poll(() =>
        scrollRegion.evaluate((node, iso) => {
          const cell = node.querySelector<HTMLElement>(
            `[data-day-cell][data-day-iso="${iso}"]`
          );
          if (!cell) return Number.POSITIVE_INFINITY;
          const maxScrollTop = Math.max(
            0,
            node.scrollHeight - node.clientHeight
          );
          const idealScrollTop =
            node.scrollTop +
            cell.getBoundingClientRect().top -
            node.getBoundingClientRect().top +
            cell.offsetHeight / 2 -
            node.clientHeight / 2;
          const clampedIdeal = Math.max(
            0,
            Math.min(maxScrollTop, idealScrollTop)
          );
          return Math.abs(node.scrollTop - clampedIdeal);
        }, currentDateIso)
      )
      .toBeLessThan(3);

  await expectTodayScrolledAsCenteredAsPossible();

  const headerBefore = await page.locator("header").boundingBox();
  const viewportBefore = await scrollRegion.boundingBox();
  await expandedToggle.click();
  const collapsedToggle = page.getByRole("button", { name: collapsedLabel });
  if (mobile) {
    await expect(collapsedToggle).toHaveAttribute("aria-expanded", "false");
  } else {
    await expect(collapsedToggle).toHaveAttribute("aria-pressed", "true");
  }
  const headerAfter = await page.locator("header").boundingBox();
  const viewportAfter = await scrollRegion.boundingBox();
  if (!headerBefore || !headerAfter || !viewportBefore || !viewportAfter) {
    throw new Error("Layout desktop não renderizado");
  }
  expect(headerAfter.height).toBeLessThan(headerBefore.height);
  expect(viewportAfter.y).toBeLessThan(viewportBefore.y);

  await expectTodayScrolledAsCenteredAsPossible();

  const centeredScrollTop = await scrollRegion.evaluate((node) => node.scrollTop);
  // Cabeçalho minimizado libera bastante altura, então a rolagem central
  // pode já estar no máximo possível (sem folga pra baixo) — rola pra CIMA
  // em vez de baixo, e mede o delta real aplicado (o navegador limita ao
  // que houver de folga) em vez de assumir 120px cravados.
  await scrollRegion.evaluate((node) => {
    node.scrollTop = Math.max(0, node.scrollTop - 120);
  });
  await page.waitForTimeout(150);
  const manualScrollTop = await scrollRegion.evaluate((node) => node.scrollTop);
  expect(manualScrollTop).toBeLessThan(centeredScrollTop);
  await page.waitForTimeout(150);
  expect(await scrollRegion.evaluate((node) => node.scrollTop)).toBe(manualScrollTop);

  await page.reload();
  if (mobile) {
    await expect(
      page.getByRole("button", { name: expandedLabel })
    ).toHaveAttribute("aria-expanded", "true");
  } else {
    await expect(
      page.getByRole("button", { name: expandedLabel })
    ).toHaveAttribute("aria-pressed", "false");
  }
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
  // .inverse-product-surface (bg-card) em tema claro é o --card do tema
  // escuro (#262626) — não o tom de azul-marinho antigo (ver #44).
  expect(
    await panel.evaluate((node) => getComputedStyle(node).backgroundColor)
  ).toBe("rgb(38, 38, 38)");
});

test("aplicação permanece interativa atrás do primeiro card", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "A jornada guiada começa no desktop"
  );
  // Ver nota em "sandbox convida após cinco alvos...": o cabeçalho desktop só
  // fica travado expandido a partir de date_category_selection — no passo
  // inicial (context_selection), abaixo de 860px de altura ele se
  // auto-minimiza, escondendo o chip de perfil que este teste clica.
  await page.setViewportSize({ width: 1280, height: 900 });
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

  const themeControl = page.locator("[data-onboarding-theme-control]:visible");
  await expect(themeControl).toBeEnabled();
  await themeControl.click();

  await panel.getByRole("button", { name: "Entrar na sua conta" }).click();
  await expect(page.getByRole("dialog", { name: "Entrar" })).toBeVisible();
});

test("edição preserva categoria não inicial no desktop e no mobile", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  if (!mobile) {
    // Ver nota em "sandbox convida após cinco alvos...": abaixo de 860px de
    // altura o cabeçalho desktop se auto-minimiza fora de uma jornada guiada
    // travada, colapsando perfis/categorias.
    await page.setViewportSize({ width: 1280, height: 900 });
  }
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
          // O ano de exemplo repete alguns títulos de evento entre 2025 e
          // 2026 (ver getPersonalDemoEventsFor2025, #77) — sem checar o ano
          // original, o filtro por título sozinho pegaria as duas cópias e
          // criaria um duplicata ambíguo na mesma data.
          const isCurrentYearEvent = String(event.startDate ?? "").startsWith(
            String(today.getFullYear())
          );
          return (
            isCurrentYearEvent &&
            (event.title === editedEventTitle ||
              event.title === comparisonEventTitle)
          )
            ? { ...authorEvent, startDate: todayIso, endDate: todayIso }
            : authorEvent;
        }
      );
      localStorage.setItem("yiv-store", JSON.stringify(payload));
      localStorage.setItem(
        "doze52:onboarding:v2",
        JSON.stringify({
          version: 13,
          step: "completed",
          context: "personal",
          completedAt: new Date().toISOString(),
          postOnboardingEventsCreated: 0,
          postOnboardingCategoriesCreated: 0,
        })
      );
      // A jornada de Hábitos no mobile (lib/mobile-habits-onboarding.ts) é
      // independente do guia desktop acima — sem isto, o reload com
      // mobileUi=1 abaixo mostraria o card "Passo 1 de 8" por cima de tudo.
      localStorage.setItem("doze52:mobile-habits-onboarding:v1", "dismissed");
    },
    { editedEventTitle, comparisonEventTitle }
  );

  // Perfis/categorias são conceito da Anual — no mobile, "surface" cai em
  // Hábitos por padrão (ver resolveInitialProductDestination).
  await page.goto(mobile ? "/?mobileUi=1&surface=annual" : "/?mobileUi=0");
  // No seletor compacto do mobile, o perfil já ativo some da lista (ela só
  // lista os OUTROS contextos para trocar — ver `mobileDense` em
  // components/profile-bar.tsx) — como "Pessoal" já é o contexto ativo aqui,
  // não há chip para clicar, e suas categorias já aparecem por padrão.
  const pessoalChip = page.locator(
    '[data-onboarding-profile-id][title="Pessoal"]'
  );
  if (await pessoalChip.count()) {
    await pessoalChip.click();
  }

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
  // A descrição mora atrás de "Mais opções", recolhido por padrão desde a
  // revisão de UX do evento (#80).
  await dialog.getByText("Mais opções").click();
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
  // 4 categorias por contexto (Pessoal + Profissional), sem Feriados/F1 nem
  // Aniversários/Entregas (de fora do ano de exemplo desde #95).
  expect(stored.categories).toHaveLength(8);
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
  // Ver nota em "sandbox convida após cinco alvos...": fora de uma jornada
  // guiada travada, abaixo de 860px de altura o cabeçalho desktop se
  // auto-minimiza e esconde o chip de perfil verificado adiante.
  await page.setViewportSize({ width: 1280, height: 900 });
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
  // O contexto Pessoal já chega com 4 categorias de demonstração (#95).
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(4);
  const persistedStep = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("doze52:onboarding:v2") ?? "null")
  );
  expect(persistedStep).toMatchObject({
    version: 15,
    step: "dismissed_preserved",
  });

  await page
    .getByRole("button", { name: "Organizar" })
    .click();
  for (const name of ["Saúde", "Família", "Projetos"]) {
    await page.getByRole("button", { name: "Criar nova categoria" }).click();
    // "Adicionar categoria" agora escolhe entre categoria própria e
    // calendário pronto antes de chegar no formulário de nome (#75).
    await page
      .getByRole("dialog", { name: "Adicionar categoria" })
      .getByRole("button", { name: "Criar minha categoria" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Nova categoria" });
    await dialog.getByLabel("Nome da categoria").fill(name);
    await dialog.getByRole("button", { name: "Criar", exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  // O painel "Organizar" (#94) marca o resto da página aria-hidden enquanto
  // aberto — o convite de conta já existe por baixo, só não é alcançável
  // pela árvore de acessibilidade até fechar o painel.
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Organizar" })
  ).toBeHidden();
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
    // Feriados/F1 não vêm mais junto no ano de exemplo (#95) — a
    // substituição automática troca só o grupo do próprio exemplo, agora v8
    // (não mais v7).
    .toEqual(["onboarding-personal-demo-v8"]);
});

test("sandbox convida após cinco alvos e retoma o onboarding limpo", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  test.skip(mobile, "Entrada no sandbox coberta no desktop");
  if (!mobile) {
    // Abaixo de 860px de altura o cabeçalho desktop se auto-minimiza fora de
    // uma jornada guiada travada (`headerMinimized`, ver app/page.tsx), o que
    // colapsa a região de perfis/categorias para altura zero. O viewport
    // padrão de teste (1280x720) cai nesse limiar, então este teste — que
    // clica direto nos chips — precisa de uma altura maior, como os demais
    // fluxos que interagem com esses controles (ver completePersonalOnboarding).
    await page.setViewportSize({ width: 1280, height: 900 });
  }
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
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(4);
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
      categories?: Array<{ name: string }>;
      events?: unknown[];
    };
  });
  expect(cleanSnapshot.profiles?.map((profile) => profile.name)).toEqual([
    "Pessoal",
  ]);
  // O guia compõe sobre o ano de exemplo em vez de partir de zero (ver
  // commit "Refina onboarding guiado: seed composto..." #95) — o contexto
  // Pessoal já chega com 4 categorias e eventos de demonstração.
  expect(cleanSnapshot.categories?.map((category) => category.name)).toEqual([
    "Eventos",
    "Família",
    "Amigos",
    "Viagens",
  ]);
  expect(cleanSnapshot.events?.length).toBeGreaterThan(0);
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
  // Com a navegação adaptativa sempre ligada (ver `useAdaptiveNavigation` em
  // app/page.tsx), os controles de filtro colapsam para altura zero enquanto
  // o card guiado ocupa o lugar deles — o card termina exatamente onde a
  // região de filtros começa, sem o separador antigo entre os dois.
  expect(
    Math.abs(overlayBox.y + overlayBox.height - filterBox.y)
  ).toBeLessThan(1);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport indisponível");
  expect(overlayBox.y).toBeGreaterThanOrEqual(0);
  expect(overlayBox.y + overlayBox.height).toBeLessThanOrEqual(
    viewport.height
  );
  const filterControls = filterRegion.locator(":scope > div").first();
  await expect(filterControls).toHaveAttribute("inert", "");
  await expect(filterControls).toHaveAttribute("aria-hidden", "true");
  await expect(
    mobile
      ? page.locator("[data-onboarding-edit-control]")
      : page.locator('[data-product-organize="desktop"]')
  ).toBeEnabled();
  // A criação de categoria/calendário foi consolidada no painel Organizar
  // (ver commit "Ajusta densidade do header desktop..." #94) — não há mais
  // um controle de calendário sempre visível fora dele para checar aqui.
  await expect(page.locator("[data-onboarding-year-control]").first()).toBeEnabled();
  await expect(
    page.locator("[data-onboarding-theme-control]:visible")
  ).toBeEnabled();
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
    // A densidade do cabeçalho desktop foi ajustada (#94) e deixou uma
    // sobreposição de poucos pixels por design (sombra/borda); o header em
    // si não se move com o scroll do calendário (ele fica fora da região
    // rolável), então essa pequena folga é constante, não um vazamento.
    expect(noticeBoxAfterScroll.y).toBeGreaterThanOrEqual(-4);
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
  // O card usa .inverse-product-surface (bg-card) — em tema claro isso é
  // o --card do tema escuro (#262626), não um tom de azul-marinho antigo.
  await expect(nudge).toHaveCSS("background-color", "rgb(38, 38, 38)");

  await page.locator("[data-onboarding-theme-control]:visible").click();
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

  // A navegação adaptativa mantém uma instância mobile (md:hidden) e uma
  // desktop com o mesmo atributo, alternadas por CSS — só uma fica visível.
  const themeControl = page.locator("[data-onboarding-theme-control]:visible");
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
  // O guia compõe sobre o ano de exemplo em vez de partir de zero (ver
  // commit "Refina onboarding guiado: seed composto..." #95) — o contexto
  // Profissional já chega com 4 categorias de demonstração.
  await expect(page.locator("[data-onboarding-category-id]")).toHaveCount(4);

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
        version: 13,
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
