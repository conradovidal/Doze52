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
  mobile: boolean,
  options: { beforeFinish?: () => Promise<void> } = {}
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
  await expect(panel).toContainText(
    "Comece pelo aniversário das suas pessoas favoritas, ou por datas importantes para você."
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
  ).toContainText(/outra pessoa especial/i);

  await selectGuidedDate(page, mobile, "2026-09-12");
  await expect(eventDialog).toBeVisible();
  await eventDialog.getByLabel("Título do evento").fill("Aniversário do pai");
  await eventDialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(eventDialog).toBeHidden();

  // Depois das datas o guia vai direto para Hábitos: visibilidade, ano,
  // edição, calendários prontos, Q1-Q4 e tema deixaram de pausar o guia
  // (são descobríveis sozinhos; calendário pronto virou sugestão no resumo).
  const editControl = mobile
    ? page.locator("[data-onboarding-edit-control]")
    : page.locator('[data-product-organize="desktop"]');
  const adaptiveDesktop =
    !mobile &&
    (await page.locator('[data-product-navigation="desktop"]').isVisible());
  if (!mobile) {
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
    await page.getByRole("button", { name: "Criar", exact: true }).click();

    const habitCreatedNotice = page.locator(
      '[data-guided-toolbar-notice][data-guided-toolbar-target="habit-created"]:visible'
    );
    await expect(habitCreatedNotice).toBeVisible();
    await habitCreatedNotice.getByRole("button", { name: "Continuar" }).click();
  }
  for (const removedTarget of ["visibility", "year", "edit", "calendars", "period-navigation", "theme"]) {
    await expect(
      page.locator(
        `[data-guided-toolbar-notice][data-guided-toolbar-target="${removedTarget}"]`
      )
    ).toHaveCount(0);
  }

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
    // O resumo acontece com Hábitos ainda no fundo (vitrine incluída); a
    // virada para Eventos só vem no "Finalizar guia".
    await expect(page).toHaveURL(/surface=habits/);
    await expect(
      page.getByRole("button", { name: "Exercício", exact: true })
    ).toBeVisible();
    await editControl.click();
  }
  await options.beforeFinish?.();
  const finishGuideButton = page.getByRole("button", { name: "Finalizar guia" });
  await expect(finishGuideButton).toBeVisible();
  await finishGuideButton.click();
  await expect(panel).toBeHidden();
  await expect(toolbarNotice).toBeHidden();
  await expect(page).toHaveURL(/surface=annual/);
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
    "Escolha um contexto para começar."
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
    version: 15,
    step: "completed",
    context: "personal",
  });
  expect(stored.store?.state?.profiles?.[0]?.name).toBe("Pessoal");
  // Calendário pronto saiu do guia (virou sugestão no resumo final): ao
  // terminar, sobra só a categoria criada no tour, com os itens dela.
  expect(stored.store?.state?.categories?.map((item) => item.name)).toEqual([
    "Aniversários",
  ]);
  expect(stored.store?.state?.categories?.[0]?.color).toBe("#EF8F8F");
  expect(stored.store?.state?.events?.length).toBeGreaterThanOrEqual(2);
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

  // O botão dedicado de calendários no cabeçalho saiu com a navegação
  // adaptativa (#97) — hoje "Adicionar calendário pronto" mora dentro do
  // fluxo "Adicionar categoria" (CategoryCreationFlow), alcançado por
  // Organizar → aba Categorias → escolher o contexto → "Nova categoria".
  // Como `onImported` fecha o diálogo inteiro (CategoryCreationFlow), cada
  // pacote precisa reabrir esse caminho — não dá pra importar os dois numa
  // única passagem pelo diálogo.
  // Calendários prontos moram no Organizar: "+" (Criar nova categoria) →
  // "Adicionar calendário pronto" → tela "Calendários", tudo dentro do
  // próprio painel (#118).
  const openCalendarPacks = async () => {
    const panel = page.locator("[data-filter-edit-panel]");
    if (!(await panel.isVisible())) {
      await page.locator('[data-product-organize="desktop"]').click();
      await expect(panel).toBeVisible();
    }
    const calendarDialog = page.getByRole("dialog", { name: "Calendários" });
    if (!(await calendarDialog.isVisible())) {
      await page.getByRole("button", { name: "Criar nova categoria" }).click();
      await page.getByRole("button", { name: /Adicionar calendário pronto/ }).click();
    }
    await expect(calendarDialog).toBeVisible();
    return calendarDialog;
  };
  const importPack = async (card: Locator) => {
    const groupId = await card.getAttribute("data-calendar-pack-group");
    await card.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const payload = JSON.parse(window.localStorage.getItem("yiv-store") ?? "{}");
          return (payload.state?.categories ?? []).some(
            (category: { calendarPackGroupId?: string }) =>
              category.calendarPackGroupId === id
          );
        }, groupId)
      )
      .toBe(true);
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
      .getByRole("combobox", { name: /Estado para Feriados/i })
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
    name: /Estado para Feriados/i,
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
      name: /Estado para Feriados/i,
    })
  ).toHaveText(/São Paulo \(SP\)/i);
  await reopenedHolidayCard.getByRole("button", { name: "Remover" }).click();
  await page.keyboard.press("Escape");
  await page.reload();
  await waitForHolidayVariant(null);
  await expect(
    page.getByRole("button", { name: "Feriados", exact: true })
  ).toHaveCount(0);
  // "Corridas F1" é o nome do pacote no seletor; a categoria criada se
  // chama "Etapas F1" (ver lib/calendar-packs/formula-1-2026.ts).
  await expect(
    page.getByRole("button", { name: "Etapas F1", exact: true })
  ).toBeVisible();
  await openCalendarPacks();
  await expect(
    holidayCard.getByRole("button", { name: "Adicionar", exact: true })
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
  const editWorkspace = page.getByRole("button", { name: "Editar", exact: true });
  const organizeDialog = page.getByRole("dialog", { name: "Editar", exact: true });
  await expect(async () => {
    await editWorkspace.click();
    await expect(organizeDialog).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 10_000 });
  await organizeDialog
    .getByRole("button", { name: "Editar categoria Família" })
    .first()
    .click();
  const categoryDialog = page.getByRole("dialog", { name: "Editar categoria" });
  await categoryDialog.getByRole("button", { name: "Excluir categoria" }).click();

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

  // Jornada própria do mobile (lib/mobile-habits-onboarding.ts): 7 passos,
  // de Hábitos até o Perfil, com a tela de Eventos travada até marcar o
  // primeiro dia.
  await expect(habitCard).toContainText("Passo 1 de 7");
  await expect(habitCard).toContainText("Construa seus hábitos aqui");
  await habitCard.getByRole("button", { name: "Continuar" }).click();

  await expect(habitCard).toContainText("Passo 2 de 7");
  await expect(habitCard).toContainText("Estes dois hábitos são exemplo.");
  await expect(annualNav).toHaveAttribute("aria-disabled", "true");
  await page
    .locator('[data-habits-prototype] button[aria-label="Criar novo hábito"]')
    .click();
  await page.getByLabel("Nome do hábito").fill("Beber água");
  await page.getByRole("button", { name: "Criar", exact: true }).click();

  // Avança sozinho ao criar; Eventos segue travado até marcar um dia.
  await expect(habitCard).toContainText("Passo 3 de 7");
  await expect(habitCard).toContainText("Toque num dia recente");
  await expect(annualNav).toHaveAttribute("aria-disabled", "true");
  await page
    .locator('[data-habits-prototype] button[aria-pressed="false"]:not([disabled])')
    .last()
    .click();

  // Avança sozinho ao marcar; Eventos libera e é o alvo apontado pelo card.
  await expect(habitCard).toContainText("Passo 4 de 7");
  await expect(habitCard).toContainText("conhecer sua agenda de eventos");
  await expect(annualNav).not.toHaveAttribute("aria-disabled", "true");

  await annualNav.click();
  await expect(page).toHaveURL(/surface=annual/);
  await expect(page.locator("[data-mobile-calendar-experience]")).toBeVisible();
  await expect(page.locator("[data-calendar-event-id]").first()).toBeVisible();

  await expect(habitCard).toContainText("Passo 5 de 7");
  await expect(habitCard).toContainText("Este é um ano de exemplo.");
  await habitCard.getByRole("button", { name: "Continuar" }).click();

  // Organizar: o card aponta para o lápis; dentro dele as sugestões de
  // categoria e "Finalizar" fecham o passo.
  await expect(habitCard.first()).toContainText("Passo 6 de 7");
  await page.locator('[data-product-organize="mobile"]').click();
  await page
    .getByRole("button", { name: "Finalizar", exact: true })
    .first()
    .click();

  await expect(habitCard).toContainText("Passo 7 de 7");
  await expect(habitCard).toContainText("Toque em Perfil");
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
  await expect(notice).toContainText("desktop");

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
  // Variante "retomando": quem começou o guia no desktop é lembrado de que
  // o ano completo aparece lá (mobile-desktop-first-notice.tsx).
  await expect(notice).toContainText("aparece completo no desktop");
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

test("categorias recolhidas liberam espaço e o ano leva de volta a hoje", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chromium";
  test.skip(mobile, "Comportamento do cabeçalho coberto no desktop");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?mobileUi=0");
  await page.getByRole("button", { name: "Encerrar guia inicial" }).click();

  // O botão de minimizar (ao lado de Eventos/Hábitos) libera a altura da
  // faixa de contextos e categorias; aria-pressed indica o estado.
  const expandedToggle = page.getByRole("button", {
    name: "Minimizar contextos e categorias",
  });
  await expect(expandedToggle).toHaveAttribute("aria-pressed", "false");

  const scrollRegion = page.locator("[data-desktop-calendar-scroll-region]");
  await scrollRegion.evaluate((node) => {
    node.scrollTop = 80;
  });
  const scrollBefore = await scrollRegion.evaluate((node) => node.scrollTop);
  const headerBefore = await page.locator("header").boundingBox();
  const viewportBefore = await scrollRegion.boundingBox();

  await expandedToggle.click();
  const collapsedToggle = page.getByRole("button", {
    name: "Mostrar contextos e categorias",
  });
  await expect(collapsedToggle).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(400);
  const headerAfter = await page.locator("header").boundingBox();
  const viewportAfter = await scrollRegion.boundingBox();
  if (!headerBefore || !headerAfter || !viewportBefore || !viewportAfter) {
    throw new Error("Layout desktop não renderizado");
  }
  expect(headerAfter.height).toBeLessThan(headerBefore.height);
  expect(viewportAfter.y).toBeLessThan(viewportBefore.y);
  // Recolher não mexe na rolagem da grade (nada de "dançar" sozinha).
  expect(await scrollRegion.evaluate((node) => node.scrollTop)).toBe(scrollBefore);

  // Clicar no ano (aba presa à grade) é o "Ir para hoje": centraliza o dia
  // atual o quanto a rolagem permitir.
  const todayIso = await page.evaluate(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  });
  await scrollRegion.evaluate((node) => {
    node.scrollTop = 0;
  });
  await page
    .locator("[data-year-grid-dock] [data-calendar-year-stepper]")
    .getByRole("button", { name: /Ir para hoje/ })
    .click();
  await expect
    .poll(() =>
      scrollRegion.evaluate((node, iso) => {
        const cell = node.querySelector<HTMLElement>(
          `[data-day-cell][data-day-iso="${iso}"]`
        );
        if (!cell) return Number.POSITIVE_INFINITY;
        const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
        const idealScrollTop =
          node.scrollTop +
          cell.getBoundingClientRect().top -
          node.getBoundingClientRect().top +
          cell.offsetHeight / 2 -
          node.clientHeight / 2;
        const clampedIdeal = Math.max(0, Math.min(maxScrollTop, idealScrollTop));
        return Math.abs(node.scrollTop - clampedIdeal);
      }, todayIso)
    )
    .toBeLessThan(3);

  await page.reload();
  // Ao recarregar, o cabeçalho volta expandido (padrão por altura da janela).
  await expect(
    page.getByRole("button", { name: "Minimizar contextos e categorias" })
  ).toHaveAttribute("aria-pressed", "false");
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
  await expect(dialog.getByRole("combobox").nth(1)).toContainText("Geral");
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: /Noite de fondue$/ }).click();
  dialog = page.getByRole("dialog", { name: "Editar evento" });
  await dialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Geral", exact: true }).click();
  await dialog.getByRole("button", { name: "Salvar" }).click();

  const expectedCategory = await page.evaluate(() => {
    const payload = JSON.parse(localStorage.getItem("yiv-store") ?? "{}");
    return payload.state.categories.find(
      (category: { name: string; profileId: string }, _index: number, categories: Array<{ name: string; profileId: string }>) =>
        category.name === "Geral" &&
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
  // No primeiro passo não há nada a perder: o X fecha sem confirmação.
  await panel.getByRole("button", { name: "Encerrar guia inicial" }).click();
  await expect(page.locator("[data-onboarding-exit-dialog]")).toHaveCount(0);
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
  const exitDialog = page.getByRole("dialog", { name: /Encerrar o guia\?/ });
  await expect(exitDialog).toContainText("O que você criou continua no seu ano");
  await exitDialog.getByRole("button", { name: "Encerrar e explorar" }).click();
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
    .getByRole("button", { name: "Editar", exact: true })
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
  // O convite (a Conta em modo cadastro) espera o painel Editar fechar —
  // nunca abre um modal por cima do outro.
  const accountHero = page.getByRole("heading", { name: "Guarde o seu ano" });
  await page.waitForTimeout(800);
  await expect(accountHero).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Editar", exact: true })
  ).toBeHidden();
  await expect(accountHero).toBeVisible();
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
    .toEqual(["onboarding-personal-demo-v9"]);
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

  await page.locator('[data-onboarding-category-id][title="Família"]').click();
  await page.locator('[data-onboarding-category-id][title="Amigos"]').click();
  await page.locator('[data-onboarding-category-id][title="Viagens"]').click();
  await page.locator('[data-onboarding-profile-id][title="Profissional"]').click();
  await page.locator('[data-onboarding-category-id][title="Geral"]').click();

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
  // A instrução do primeiro passo cabe numa linha só, sem estourar.
  const contextTitle = panel.getByText("Escolha um contexto para começar.");
  expect(
    await contextTitle.evaluate(
      (node) =>
        node.scrollWidth <= node.clientWidth &&
        node.getBoundingClientRect().height <=
          Number.parseFloat(getComputedStyle(node).lineHeight) + 1
    )
  ).toBe(true);
  if (!mobile) {
    const panelBox = await panel.boundingBox();
    const viewport = page.viewportSize();
    if (!panelBox || !viewport) throw new Error("Card inicial não renderizado");
    expect(
      Math.abs(panelBox.x + panelBox.width / 2 - viewport.width / 2)
    ).toBeLessThan(3);
    // Na vertical o card centraliza na parte visível da grade (não na
    // janela), para não cobrir o cabeçalho — ver guided-onboarding-panel.
    const gridBox = await page.locator("[data-year-grid-frame]").first().boundingBox();
    if (!gridBox) throw new Error("Grade não renderizada");
    const visibleTop = Math.max(12, gridBox.y);
    const visibleBottom = Math.min(viewport.height - 12, gridBox.y + gridBox.height);
    expect(
      Math.abs(panelBox.y + panelBox.height / 2 - (visibleTop + visibleBottom) / 2)
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
    "Geral",
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
  // O card guiado ocupa o lugar da faixa de filtros: fica entre a
  // navegação e a grade, sem cobrir nenhuma das duas.
  const [navRowBox, gridFrameBox] = await Promise.all([
    page.locator("[data-app-header-navigation-row]").boundingBox(),
    page.locator("[data-year-grid-frame]").first().boundingBox(),
  ]);
  if (!navRowBox || !gridFrameBox) throw new Error("Cabeçalho ou grade ausente");
  expect(overlayBox.y).toBeGreaterThanOrEqual(navRowBox.y + navRowBox.height - 0.5);
  expect(overlayBox.y + overlayBox.height).toBeLessThanOrEqual(gridFrameBox.y + 0.5);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport indisponível");
  expect(overlayBox.y).toBeGreaterThanOrEqual(0);
  expect(overlayBox.y + overlayBox.height).toBeLessThanOrEqual(
    viewport.height
  );
  // Os controles ficam dentro da região recolhível (#app-header-filter-region)
  // e travados enquanto o card guiado ocupa o lugar deles.
  const filterControls = filterRegion.locator("#app-header-filter-region [inert]").first();
  await expect(filterControls).toHaveAttribute("inert");
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
  const noticeTitleFontSize = await notice
    .locator("p")
    .first()
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  // Faixa guiada compacta de uma linha (text-sm, desde #107).
  expect(noticeTitleFontSize).toBeGreaterThanOrEqual(14);
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

test("dois eventos espontâneos abrem a Conta em modo cadastro", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Criação normal coberta no desktop"
  );
  await page.goto("/?mobileUi=0");
  await completePersonalOnboarding(page, false);

  // Em vez do antigo card "Guarde seu ano" no canto, o convite abre direto
  // a própria Conta (com Google e formulário), já em "Cadastro".
  const accountHero = page.getByRole("heading", { name: "Guarde o seu ano" });
  await createRegularEvent(page, "2026-06-02", "Evento espontâneo 1");
  await expect(accountHero).toBeHidden();
  await createRegularEvent(page, "2026-07-03", "Evento espontâneo 2");
  await expect(accountHero).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar com Google" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();

  // Só uma vez: fechar e criar mais um evento não reabre.
  await page.keyboard.press("Escape");
  await expect(accountHero).toBeHidden();
  await createRegularEvent(page, "2026-08-04", "Evento espontâneo 3");
  await page.waitForTimeout(800);
  await expect(accountHero).toBeHidden();
});

test("resumo mantém o ano de exemplo e o teto de 3 vale também pelo +", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "O guia completo roda no desktop"
  );
  const readCategories = () =>
    page.evaluate(() => {
      const raw = window.localStorage.getItem("yiv-store");
      const parsed = raw ? JSON.parse(raw) : null;
      return (parsed?.state?.categories ?? []) as {
        name: string;
        calendarPackGroupId?: string;
      }[];
    });
  const isDemo = (category: { calendarPackGroupId?: string }) =>
    Boolean(category.calendarPackGroupId?.startsWith("onboarding-personal-demo"));

  await page.goto("/?mobileUi=0");
  await completePersonalOnboarding(page, false, {
    beforeFinish: async () => {
      // O ano de exemplo segue no fundo durante o resumo…
      expect((await readCategories()).some(isDemo)).toBe(true);
      const panel = page.locator("[data-filter-edit-panel]");
      await expect(panel).toBeVisible();
      for (const name of ["Geral", "Saúde"]) {
        await panel.getByRole("button", { name: `Adicionar categoria ${name}` }).click();
        await page.waitForTimeout(400);
      }
      await expect
        .poll(async () => (await readCategories()).filter((c) => !isDemo(c)).length)
        .toBe(3);

      // …e um calendário pronto pelo "+" (fluxo próprio, fora das
      // sugestões) troca a última em vez de virar a 4ª.
      await page.getByRole("button", { name: "Criar nova categoria" }).click();
      await page.getByRole("button", { name: /Adicionar calendário pronto/ }).click();
      const calendarDialog = page.getByRole("dialog", { name: "Calendários" });
      await expect(calendarDialog).toBeVisible();
      await calendarDialog
        .locator('[data-calendar-pack-group]')
        .first()
        .getByRole("button", { name: "Adicionar", exact: true })
        .click();
      await expect(calendarDialog).toBeHidden();
      if (!(await panel.isVisible())) {
        await page.locator('[data-product-organize="desktop"]').click();
      }
      await expect(panel).toBeVisible();
      await expect
        .poll(async () => (await readCategories()).filter((c) => !isDemo(c)).length)
        .toBe(3);
      expect(
        (await readCategories()).some(
          (c) => c.calendarPackGroupId && !isDemo(c)
        )
      ).toBe(true);

      // Um 2º calendário pronto troca o 1º (plano grátis: 1), sem abrir o
      // Pro no meio do guia, e avisa a troca.
      const firstPackGroup = (await readCategories()).find(
        (c) => c.calendarPackGroupId && !isDemo(c)
      )!.calendarPackGroupId;
      await page.getByRole("button", { name: "Criar nova categoria" }).click();
      await page.getByRole("button", { name: /Adicionar calendário pronto/ }).click();
      await expect(calendarDialog).toBeVisible();
      await calendarDialog
        // A Copa (Brasil) — foi a que apareceu vazia num teste manual.
        .locator('[data-calendar-pack-group="world-cup-2026-coverage"]')
        .getByRole("button", { name: "Adicionar", exact: true })
        .click();
      await expect(calendarDialog).toBeHidden();
      await expect(page.getByText("Doze 52 Pro", { exact: false })).toHaveCount(0);
      if (!(await panel.isVisible())) {
        await page.locator('[data-product-organize="desktop"]').click();
      }
      await expect(panel).toBeVisible();
      await expect(page.getByText("Calendário trocado")).toBeVisible();
      await expect
        .poll(async () => {
          const packs = (await readCategories()).filter(
            (c) => c.calendarPackGroupId && !isDemo(c)
          );
          return packs.map((c) => c.calendarPackGroupId).join(",");
        })
        .not.toContain(firstPackGroup!);
      await expect
        .poll(async () =>
          (await readCategories()).filter((c) => c.calendarPackGroupId && !isDemo(c)).length
        )
        .toBe(1);
      await expect
        .poll(async () => (await readCategories()).filter((c) => !isDemo(c)).length)
        .toBe(3);
      // O calendário que saiu não volta como sugestão comum (recriá-lo por
      // ali daria uma categoria vazia com o mesmo nome).
      await expect(
        panel.getByRole("button", { name: /^Adicionar categoria Feriados/ })
      ).toHaveCount(0);
    },
  });

  // Só no "Finalizar guia" o exemplo sai — e ficam as 3 dela.
  const after = await readCategories();
  expect(after.some(isDemo)).toBe(false);
  expect(after).toHaveLength(3);
  // O calendário pronto chega com os eventos dele (não só a categoria).
  const packEventCounts = await page.evaluate(() => {
    const parsed = JSON.parse(window.localStorage.getItem("yiv-store") ?? "{}");
    const categories = (parsed.state?.categories ?? []) as {
      id: string;
      name: string;
      calendarPackGroupId?: string;
    }[];
    const events = (parsed.state?.events ?? []) as { categoryId: string }[];
    return categories
      .filter((category) => category.calendarPackGroupId)
      .map((category) => ({
        name: category.name,
        events: events.filter((event) => event.categoryId === category.id).length,
      }));
  });
  for (const pack of packEventCounts) expect(pack.events).toBeGreaterThan(0);
});

test("recarregar depois do guia mantém só as categorias escolhidas", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "O guia completo roda no desktop"
  );
  await page.goto("/?mobileUi=0");
  await completePersonalOnboarding(page, false);

  const readCategories = () =>
    page.evaluate(() => {
      const raw = window.localStorage.getItem("yiv-store");
      const parsed = raw ? JSON.parse(raw) : null;
      return (parsed?.state?.categories ?? []).map(
        (category: { name: string; calendarPackGroupId?: string }) => ({
          name: category.name,
          group: category.calendarPackGroupId ?? null,
        })
      );
    });
  const before = await readCategories();
  expect(before.length).toBeLessThanOrEqual(3);
  expect(
    before.some((category: { group: string | null }) =>
      category.group?.startsWith("onboarding-personal-demo")
    )
  ).toBe(false);

  await page.reload();
  await expect(page.locator("[data-day-cell]").first()).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await readCategories()).toEqual(before);
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
  // O destaque de um controle da navegação (convite para Hábitos) também
  // não anima com redução de movimento. (Antes era o botão de tema, que
  // saiu do cabeçalho e do guia.)
  await page.evaluate(() => {
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({
        version: 15,
        step: "habit_surface_instruction",
        context: "personal",
        dateItemsCreated: 2,
        periodItemsCreated: 2,
      })
    );
  });
  await page.reload();

  const habitsDestination = page.locator(
    '[data-product-navigation="desktop"] [data-product-destination="habits"]'
  );
  await expect(habitsDestination).toHaveAttribute("data-onboarding-highlighted", "true");
  await expect(habitsDestination).toHaveCSS("animation-name", "none");
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
    "Projetos, compromissos e conquistas."
  );
  await panel.getByRole("button", { name: /Profissional/ }).click();
  await expect(panel).toContainText(
    "Comece por uma entrega ou data importante do trabalho."
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
