import { expect, test } from "@playwright/test";

const installCompletedOnboarding = async (
  page: import("@playwright/test").Page
) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({
        version: 13,
        step: "completed",
        completedAt: new Date().toISOString(),
      })
    );
    // Jornada curta e própria do mobile (lib/mobile-habits-onboarding.ts) —
    // sem isso, alguém anônimo sem hábitos ainda cai no passo "intro" e o
    // card de onboarding força os controles de Hábitos abertos
    // (effectiveExpanded em HabitControls), quebrando os testes de
    // colapsar/expandir.
    window.localStorage.setItem("doze52:mobile-habits-onboarding:v1", "completed");
    if (!window.sessionStorage.getItem("doze52:habits-e2e:initialized")) {
      window.localStorage.removeItem("doze52:habits-store:v1");
      window.sessionStorage.setItem("doze52:habits-e2e:initialized", "1");
    }
  });
};

const expectLogoPosition = async (
  page: import("@playwright/test").Page
) => {
  const logo = page.locator('[data-brand-logo-position="header-adaptive"]');
  const logoBox = await logo.boundingBox();
  const viewport = page.viewportSize();
  if (!logoBox || !viewport) throw new Error("Logo não pôde ser medido.");
  const desktop = await page
    .locator('[data-product-navigation="desktop"]')
    .isVisible()
    .catch(() => false);
  if (desktop) {
    expect(Math.round(logoBox.x)).toBe(16);
    return;
  }
  // Cabeçalho mobile é uma faixa fixa com logo à esquerda e controles à
  // direita (não mais centralizado) — ver components/app-header.tsx.
  expect(Math.round(logoBox.x)).toBe(12);
};

test("desktop antecipa a demonstração de hábitos e reinicia o guia no ano", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Cenário desktop");

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({ version: 15, step: "context_selection" })
    );
    window.localStorage.removeItem("doze52:habits-store:v1");
  });
  await page.goto("/?surface=annual");

  const onboardingPanel = page.locator(
    '[data-guided-onboarding-step="context_selection"]'
  );
  await expect(onboardingPanel).toContainText(
    "Por qual contexto você quer começar?"
  );
  const annualDemoFrameTop = (
    await page
      .locator('[data-year-grid-surface="calendar"] [data-year-grid-frame]')
      .boundingBox()
  )?.y;
  await page.getByRole("link", { name: "Hábitos" }).click();

  const habits = page.locator("[data-habits-prototype]");
  await expect(habits).toBeVisible();
  const habitsDemoFrameTop = (
    await page
      .locator('[data-year-grid-surface="habits"] [data-year-grid-frame]')
      .boundingBox()
  )?.y;
  if (annualDemoFrameTop === undefined || habitsDemoFrameTop === undefined) {
    throw new Error("Grades demonstrativas não puderam ser medidas.");
  }
  expect(Math.abs(habitsDemoFrameTop - annualDemoFrameTop)).toBeLessThanOrEqual(1);
  // A vitrine de demonstração hoje traz só 2 hábitos (Exercício, Ler 20
  // minutos) — ver ONBOARDING_HABIT_SHOWCASE_DEFINITIONS em
  // lib/habits-prototype.ts.
  for (const name of ["Exercício", "Ler 20 minutos"]) {
    await expect(habits.getByRole("button", { name, exact: true })).toBeVisible();
  }
  const habitDay = habits.locator("[data-day-cell]").first();
  // Altura para 2 hábitos de demonstração (a vitrine hoje só traz Exercício
  // e Ler 20 minutos — ver ONBOARDING_HABIT_SHOWCASE_DEFINITIONS).
  await expect.poll(async () => (await habitDay.boundingBox())?.height).toBe(54);
  await expect(habits.locator("[data-habit-marker]").first()).toBeVisible();

  const currentYear = new Date().getFullYear();
  await habits.getByTitle(`Avançar para ${currentYear + 1}`).click();
  await expect(habits.getByLabel(`Ano ${currentYear + 1}`)).toBeVisible();
  await habits.locator('button[title="Abrir Janeiro"]:visible').first().click();
  await expect(habits.locator("[data-month-row]")).toHaveCount(1);

  await page.getByRole("link", { name: "Anual" }).click();
  await expect(onboardingPanel).toBeVisible();
  await onboardingPanel
    .getByRole("button")
    .filter({ hasText: "Pessoal" })
    .click();

  await expect(page.locator('[data-product-navigation="desktop"] a[aria-current="page"]')).toHaveAttribute("title", "Anual");
  await expect(page.locator('[data-calendar-year-stepper]:visible button[aria-live="polite"]').first()).toHaveText(
    String(currentYear)
  );
  await expect(page.locator("[data-month-row]")).toHaveCount(12);
});

test("mobile abre em Hábitos e preserva a sessão entre superfícies", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "Cenário mobile");

  await installCompletedOnboarding(page);
  await page.goto("/");
  const habits = page.locator("[data-habits-prototype]");
  await expect(habits.getByRole("heading", { name: "Hábitos" })).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await expectLogoPosition(page);

  const bottomNav = page.locator('[data-product-navigation="mobile"]');
  const activeMobileDestination = bottomNav.getByRole("link", { name: "Hábitos" });
  await expect(activeMobileDestination).toHaveClass(/text-foreground/);
  await expect(activeMobileDestination).not.toHaveClass(/bg-foreground/);
  const navBox = await bottomNav.boundingBox();
  const viewport = page.viewportSize();
  if (!navBox || !viewport) throw new Error("Barra mobile não pôde ser medida.");
  expect(Math.abs(navBox.y + navBox.height - viewport.height)).toBeLessThanOrEqual(1);

  const habitPanel = habits.locator('[data-habit-controls-layout="mobile"]');
  await expect(habitPanel.getByRole("button", { name: "Recolher hábitos" })).toBeVisible();
  await expect(habits.locator("[data-mobile-habits-grid]")).toBeVisible();
  await habitPanel.getByRole("button", { name: "Recolher hábitos" }).click();
  await expect(habitPanel.getByRole("button", { name: "Criar novo hábito" })).toBeHidden();
  await habitPanel.getByRole("button", { name: "Mostrar hábitos" }).click();

  const emptyDay = habits.locator('button[aria-label^="Criar um hábito para"]').first();
  await emptyDay.click();
  await page.getByLabel("Nome do hábito").fill("Caminhar");
  await page.getByRole("button", { name: "Criar hábito" }).click();
  await expect(
    habits.getByRole("button", { name: "Caminhar", exact: true })
  ).toBeVisible();

  const storeAfterCreation = await page.evaluate(() =>
    window.localStorage.getItem("doze52:habits-store:v1")
  );
  expect(storeAfterCreation).not.toBeNull();
  expect(
    Object.keys(JSON.parse(storeAfterCreation ?? "{}").state?.checkIns ?? {})
  ).toHaveLength(0);

  await habits.getByRole("button", { name: "Criar novo hábito" }).click();
  await expect(
    page.getByRole("dialog", { name: "Mais hábitos fazem parte do Doze 52 Pro." })
  ).toBeVisible();
  await page.getByRole("button", { name: "Agora não" }).click();
  await expect(habits.getByRole("button", { name: "Ler", exact: true })).toHaveCount(0);
  await expect(page.getByText("Simulação", { exact: true })).toHaveCount(0);

  const today = habits.locator('button[aria-label^="Marcar"].ring-2');
  await expect(today).toHaveCount(1);
  await today.click();
  await expect(
    habits.locator('button.ring-2[aria-pressed="true"]')
  ).toHaveCount(1);

  const availablePast = habits.locator(
    'button[aria-label^="Marcar"][aria-pressed="false"]:not([disabled])'
  ).first();
  const pastTitle = await availablePast.getAttribute("title");
  if (!pastTitle) throw new Error("Dia passado não pôde ser identificado.");
  const pastButton = habits.getByTitle(pastTitle, { exact: true });
  await pastButton.click();
  await expect(pastButton).toHaveAttribute("aria-pressed", "true");
  await pastButton.click();
  await expect(pastButton).toHaveAttribute("aria-pressed", "false");
  expect(await habits.locator("button:disabled").count()).toBeGreaterThan(0);

  await page.getByRole("link", { name: "Anual" }).click();
  await expect(page.locator("[data-mobile-calendar-experience]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo evento" })).toBeVisible();
  await page.getByRole("link", { name: "Hábitos" }).click();
  await expect(
    habits.getByRole("button", { name: "Caminhar", exact: true })
  ).toBeVisible();
  await expect(habits.getByRole("button", { name: "Caminhar", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator("[data-habits-prototype]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Caminhar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Abrir perfil" }).click();
  const utilityPanel = page.locator("[data-app-utility-panel]");
  await expect(utilityPanel).toBeVisible();
  // No mobile, deslogado, o painel pula a navegação por abas e já abre
  // direto na seção "Conta" (components/navigation/app-utility-panel.tsx,
  // ramo isMobile && !session) — não existe um botão de aba "Conta" pra
  // clicar nesse estado.
  const googleButton = utilityPanel.getByRole("button", {
    name: "Entrar com Google",
  });
  await expect(googleButton).toBeVisible();
  await expect(googleButton.locator("[data-google-logo]")).toHaveAttribute(
    "src",
    /google-g\.svg/
  );
  await expect(
    utilityPanel.getByRole("button", { name: "Entrar", exact: true })
  ).toBeVisible();
  await utilityPanel.getByRole("button", { name: "Cadastro" }).click();
  await expect(
    utilityPanel.getByRole("button", { name: "Criar conta", exact: true })
  ).toBeVisible();
  await expect(
    utilityPanel.getByRole("button", { name: "Entrar com Google" })
  ).toBeVisible();
});

test("desktop usa grade anual de hábitos e modal com retorno de foco", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Cenário desktop");

  await installCompletedOnboarding(page);
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("doze52:habits-desktop-seeded")) return;
    const date = `${new Date().getFullYear()}-01-01`;
    const habits = [
      { id: "habit-1", name: "Caminhar", color: "#2563eb" },
      { id: "habit-2", name: "Ler", color: "#14b8a6" },
      { id: "habit-3", name: "Meditar", color: "#22c55e" },
      { id: "habit-4", name: "Alongar", color: "#eab308" },
    ].map((habit, position) => ({
      ...habit,
      icon: "circle-check",
      position,
      createdAt: `2026-01-0${position + 1}T00:00:00.000Z`,
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));
    const checkIns = Object.fromEntries(
      habits.map((habit) => [
        `${habit.id}:${date}`,
        { habitId: habit.id, date, completed: true, updatedAt: "2026-01-01T00:00:00.000Z" },
      ])
    );
    window.localStorage.setItem(
      "doze52:habits-store:v1",
      JSON.stringify({
        state: {
          habits,
          checkIns,
          selectedHabitId: "habit-1",
          visibleHabitIds: habits.map((habit) => habit.id),
        },
        version: 0,
      })
    );
    window.sessionStorage.setItem("doze52:habits-desktop-seeded", "1");
  });
  await page.goto("/");
  const desktopNavigation = page.locator('[data-product-navigation="desktop"]');
  await expect(desktopNavigation).toBeVisible();
  await expect(desktopNavigation.getByRole("link", { name: "Anual" })).toHaveClass(/text-foreground/);
  await expect(desktopNavigation.getByRole("link", { name: "Anual" })).not.toHaveClass(/bg-foreground/);
  await expectLogoPosition(page);
  const profile = page.locator('[data-product-account="desktop"]');
  const navigationBox = await desktopNavigation.boundingBox();
  const profileBox = await profile.boundingBox();
  const annualBox = await desktopNavigation.getByRole("link", { name: "Anual" }).boundingBox();
  const habitsBox = await desktopNavigation.getByRole("link", { name: "Hábitos" }).boundingBox();
  const desktopViewport = page.viewportSize();
  if (!navigationBox || !profileBox || !annualBox || !habitsBox || !desktopViewport) {
    throw new Error("Itens do cabeçalho não puderam ser medidos.");
  }
  expect(Math.abs(navigationBox.x + navigationBox.width / 2 - desktopViewport.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(annualBox.y - habitsBox.y)).toBeLessThanOrEqual(1);
  expect(Math.round(profileBox.x + profileBox.width)).toBe(desktopViewport.width - 16);
  await expect(page.locator("[data-rail-divider]")).toHaveCount(0);
  await expect(desktopNavigation.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-calendar-ui-mode="desktop"]')).toBeVisible();
  const contextualEdit = page.getByRole("button", { name: "Organizar", exact: true });
  const collapseCategories = page.getByRole("button", { name: "Recolher categorias" });
  await expect(contextualEdit).toBeVisible();
  await expect(collapseCategories).toBeVisible();
  await expect(page.locator("[data-calendar-scale-control]")).toHaveCount(0);
  const scaleBox = await page.locator("[data-calendar-footer-center]").boundingBox();
  if (!scaleBox || !desktopViewport) throw new Error("Escala não pôde ser medida.");
  expect(Math.abs(scaleBox.x + scaleBox.width / 2 - desktopViewport.width / 2)).toBeLessThanOrEqual(2);
  const calendarFrame = page.locator('[data-year-grid-surface="calendar"] [data-year-grid-frame]');
  const calendarDock = page.locator('[data-year-grid-surface="calendar"] [data-year-grid-dock]');
  const calendarYearStepper = calendarDock.locator("[data-calendar-year-stepper]");
  await expect(calendarFrame).toBeVisible();
  await expect(calendarDock).toBeVisible();
  await expect(calendarYearStepper).toBeVisible();
  const annualExpandedGeometry = await page.evaluate(() => {
    const navigationRow = document.querySelector<HTMLElement>(
      "[data-app-header-navigation-row]"
    );
    const controls = document.querySelector<HTMLElement>(
      "[data-onboarding-filter-region]"
    );
    const frame = document.querySelector<HTMLElement>(
      '[data-year-grid-surface="calendar"] [data-year-grid-frame]'
    );
    const viewport = document.querySelector<HTMLElement>(
      '[data-year-grid-surface="calendar"] [data-year-grid-scroll-viewport]'
    );
    const canvas = document.querySelector<HTMLElement>(
      '[data-year-grid-surface="calendar"] [data-year-grid-canvas]'
    );
    if (!navigationRow || !controls || !frame || !viewport || !canvas) return null;
    const navigationBox = navigationRow.getBoundingClientRect();
    const controlsBox = controls.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();
    return {
      navToDivider: controlsBox.top - navigationBox.bottom,
      controlsToGrid: frameBox.top - controlsBox.bottom,
      frameTop: frameBox.top,
      canvasLeftGap: canvasBox.left - viewportBox.left,
      canvasRightGap: viewportBox.right - canvasBox.right,
    };
  });
  expect(annualExpandedGeometry).not.toBeNull();
  expect(annualExpandedGeometry?.navToDivider).toBeCloseTo(8, 0);
  expect(annualExpandedGeometry?.controlsToGrid).toBeCloseTo(12, 0);
  expect(Math.abs(annualExpandedGeometry?.canvasLeftGap ?? 99)).toBeLessThanOrEqual(1);
  expect(Math.abs(annualExpandedGeometry?.canvasRightGap ?? 99)).toBeLessThanOrEqual(1);

  const fourthQuarter = page.getByTitle("4o trimestre");
  await fourthQuarter.click();
  await expect(fourthQuarter).toHaveAttribute("aria-pressed", "true");
  const focusedQuarterEdges = await fourthQuarter.evaluate((element) => {
    const viewport = element.closest("[data-year-grid-scroll-viewport]");
    const canvas = element.closest("[data-year-grid-canvas]");
    if (!(viewport instanceof HTMLElement) || !(canvas instanceof HTMLElement)) {
      return null;
    }
    const quarterBox = element.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();
    return {
      left: quarterBox.left - viewportBox.left,
      right: viewportBox.right - canvasBox.right,
    };
  });
  expect(focusedQuarterEdges).not.toBeNull();
  expect(Math.abs(focusedQuarterEdges?.left ?? 99)).toBeLessThanOrEqual(1);
  expect(Math.abs(focusedQuarterEdges?.right ?? 99)).toBeLessThanOrEqual(1);
  await fourthQuarter.click();
  await expect(fourthQuarter).toHaveAttribute("aria-pressed", "false");
  expect(
    await calendarYearStepper.evaluate((element) =>
      Boolean(element.closest("[data-year-grid-frame]"))
    )
  ).toBe(false);
  const frameAndDockGeometry = await page
    .locator('[data-year-grid-surface="calendar"]')
    .evaluate((element) => {
      const frame = element.querySelector<HTMLElement>("[data-year-grid-frame]");
      const dock = element.querySelector<HTMLElement>("[data-year-grid-dock]");
      if (!frame || !dock) return null;
      const frameBox = frame.getBoundingClientRect();
      const yearStepper = dock.querySelector<HTMLElement>("[data-calendar-year-stepper]");
      const yearStepperBox = yearStepper?.getBoundingClientRect();
      const frameStyle = getComputedStyle(frame);
      return {
        gap: yearStepperBox ? yearStepperBox.top - frameBox.bottom : null,
        bottomLeftRadius: Number.parseFloat(frameStyle.borderBottomLeftRadius),
        bottomRightRadius: Number.parseFloat(frameStyle.borderBottomRightRadius),
      };
    });
  expect(frameAndDockGeometry).not.toBeNull();
  expect(frameAndDockGeometry?.gap).toBeCloseTo(12, 0);
  expect(frameAndDockGeometry?.bottomLeftRadius ?? 0).toBeGreaterThanOrEqual(20);
  expect(frameAndDockGeometry?.bottomRightRadius ?? 0).toBeGreaterThanOrEqual(20);
  await expect(page.getByRole("button", { name: "Adicionar ou gerenciar calendários." })).toHaveCount(0);

  await contextualEdit.click();
  await page.getByRole("button", { name: "Criar nova categoria" }).click();
  const categoryChoice = page.getByRole("dialog", { name: "Adicionar categoria" });
  await expect(categoryChoice).toBeVisible();
  await expect(categoryChoice.getByText("Escolha o que deseja adicionar.")).toBeVisible();
  await expect(categoryChoice.getByText(/contexto/i)).toHaveCount(0);
  await expect(categoryChoice.getByRole("button", { name: /Criar minha categoria/ })).toBeVisible();
  await categoryChoice.getByRole("button", { name: /Adicionar calendário pronto/ }).click();
  const calendarGallery = page.getByRole("dialog", { name: "Calendários" });
  await expect(calendarGallery).toBeVisible();
  await expect(calendarGallery.getByRole("combobox", { name: /Contexto para/ })).toHaveCount(0);
  await expect(
    calendarGallery.getByRole("combobox", { name: /Estado para/ })
  ).toContainText("São Paulo (SP)");
  await expect(
    calendarGallery.getByRole("combobox", { name: /Time para/ })
  ).toContainText("Grêmio");
  const defaultTeamCard = calendarGallery
    .getByRole("article")
    .filter({ hasText: "Jogos do seu time favorito" });
  // Só existe 1 perfil ("Meu ano"), então não há contexto a confirmar — o
  // botão já importa direto, sem chip+select intermediário (mesmo
  // comportamento que Feriados já tinha). Não clica de verdade aqui: como
  // agora é uma ação só, clicar fecharia o diálogo (ver onImported em
  // CategoryCreationFlow) e cortaria o resto deste teste.
  await expect(
    defaultTeamCard.getByRole("button", { name: "Adicionar calendário" })
  ).toBeVisible();
  await calendarGallery.getByRole("button", { name: "Voltar para as opções de categoria" }).click();
  await expect(categoryChoice).toBeVisible();
  // Escape fecha só o diálogo "Adicionar categoria", devolvendo ao painel
  // Organizar (ainda modal — o botão do cabeçalho fica inacessível
  // enquanto ele estiver aberto); um segundo Escape finaliza a organização.
  await page.keyboard.press("Escape");
  const organizePanel = page.getByRole("dialog", { name: "Organizar" });
  await expect(organizePanel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(organizePanel).toBeHidden();
  // Layout adaptivo usa aria-expanded no botão + colapso via CSS
  // (grid-cols-[0fr]/opacity-0), não mais aria-hidden na região em si.
  const categoryRegion = page.locator("#app-header-categories-inline");
  await collapseCategories.click();
  const showCategories = page.getByRole("button", { name: "Mostrar categorias" });
  await expect(showCategories).toHaveAttribute("aria-expanded", "false");
  await expect(categoryRegion).toHaveCount(1);
  await expect
    .poll(async () => {
      const filterBox = await page
        .locator("[data-onboarding-filter-region]")
        .boundingBox();
      const frameBox = await calendarFrame.boundingBox();
      return filterBox && frameBox
        ? Math.round(frameBox.y - (filterBox.y + filterBox.height))
        : null;
    })
    .toBe(12);
  await showCategories.click();
  await expect(
    page.getByRole("button", { name: "Recolher categorias" })
  ).toHaveAttribute("aria-expanded", "true");

  // maxWidth/rowGap ficam no wrapper [data-onboarding-filter-region]; o
  // divisor com pt-3 vive num filho dentro de #app-header-filter-region
  // (CollapsibleControlRegion) — hábitos tem os três num único elemento.
  const calendarControlSpacing = await page.evaluate(() => {
    const outer = document.querySelector('[data-onboarding-filter-region]');
    const inner = document.querySelector("#app-header-filter-region > div");
    if (!outer || !inner) return null;
    const outerStyle = getComputedStyle(outer);
    return {
      maxWidth: outerStyle.maxWidth,
      paddingTop: getComputedStyle(inner).paddingTop,
      rowGap: outerStyle.rowGap,
    };
  });

  const calendarRegion = page.locator("[data-desktop-calendar-scroll-region]");
  const widthBefore = (await calendarRegion.boundingBox())?.width;
  await expect(page.getByRole("button", { name: "Abrir configurações" })).toHaveCount(0);
  await profile.click();
  const panel = page.locator("[data-app-utility-panel]");
  await expect(panel).toBeVisible();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport desktop indisponível.");
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(
    Math.min(720, viewport.width - 80)
  );
  const panelBox = await panel.boundingBox();
  if (!panelBox) throw new Error("Painel não pôde ser medido.");
  // O painel de conta virou um diálogo centralizado padrão (não mais
  // ancorado ao botão de perfil) — ver commit "...centraliza o painel...".
  expect(
    Math.abs(panelBox.x + panelBox.width / 2 - viewport.width / 2)
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(panelBox.y + panelBox.height / 2 - viewport.height / 2)
  ).toBeLessThanOrEqual(1);
  expect((await calendarRegion.boundingBox())?.width).toBe(widthBefore);
  await expect(panel.getByText("Plano", { exact: true })).toBeVisible();
  await expect(panel.getByText("Dados", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(profile).toBeFocused();

  await calendarRegion.evaluate((element) => {
    element.scrollTop = 240;
  });
  const savedScrollTop = await calendarRegion.evaluate(
    (element) => element.scrollTop
  );
  await page.getByRole("link", { name: "Hábitos" }).click();
  const habitControlsBox = await page.locator('[data-habit-controls-layout="desktop"]').boundingBox();
  if (!habitControlsBox) throw new Error("Controles de hábitos não puderam ser medidos.");
  const habitControlSpacing = await page
    .locator('[data-habit-controls-layout="desktop"]')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        maxWidth: style.maxWidth,
        paddingTop: style.paddingTop,
        rowGap: style.rowGap,
      };
    });
  expect(habitControlSpacing).toEqual(calendarControlSpacing);
  expect(
    Math.abs(
      habitControlsBox.x + habitControlsBox.width / 2 - desktopViewport.width / 2
    )
  ).toBeLessThanOrEqual(2);
  await expect(desktopNavigation.getByRole("link", { name: "Hábitos" })).toHaveClass(/text-foreground/);
  const habits = page.locator("[data-habits-prototype]");
  await expect(habits).toHaveAttribute("data-habits-layout", "desktop-year");
  const habitsFrame = page.locator(
    '[data-year-grid-surface="habits"] [data-year-grid-frame]'
  );
  const habitsExpandedGeometry = await page.evaluate(() => {
    const navigationRow = document.querySelector<HTMLElement>(
      "[data-app-header-navigation-row]"
    );
    const controls = document.querySelector<HTMLElement>(
      '[data-habit-controls-layout="desktop"]'
    );
    const frame = document.querySelector<HTMLElement>(
      '[data-year-grid-surface="habits"] [data-year-grid-frame]'
    );
    const viewport = document.querySelector<HTMLElement>(
      '[data-year-grid-surface="habits"] [data-year-grid-scroll-viewport]'
    );
    const canvas = document.querySelector<HTMLElement>(
      '[data-year-grid-surface="habits"] [data-year-grid-canvas]'
    );
    if (!navigationRow || !controls || !frame || !viewport || !canvas) return null;
    const navigationBox = navigationRow.getBoundingClientRect();
    const controlsBox = controls.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();
    return {
      navToDivider: controlsBox.top - navigationBox.bottom,
      controlsToGrid: frameBox.top - controlsBox.bottom,
      frameTop: frameBox.top,
      canvasLeftGap: canvasBox.left - viewportBox.left,
      canvasRightGap: viewportBox.right - canvasBox.right,
    };
  });
  expect(habitsExpandedGeometry).not.toBeNull();
  // A densidade "mais justa" que o #94 deu a Hábitos (sem divisor entre a
  // navegação e os controles) tornou a experiência inconsistente com a
  // Anual — os elementos pareciam se mover ao trocar de superfície. Corrigido
  // para reproduzir exatamente os mesmos dois espaços fixos da Anual (gap
  // acima da faixa de controles + acima da grade), independente do estado
  // de expandido/recolhido.
  expect(habitsExpandedGeometry?.navToDivider).toBeCloseTo(8, 0);
  expect(habitsExpandedGeometry?.controlsToGrid).toBeCloseTo(12, 0);
  expect(Math.abs(habitsExpandedGeometry?.canvasLeftGap ?? 99)).toBeLessThanOrEqual(1);
  expect(Math.abs(habitsExpandedGeometry?.canvasRightGap ?? 99)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Recolher hábitos" }).click();
  // O gap fixo (12px, igual à Anual) não muda ao recolher só a fileira de
  // hábitos — só a largura da fileira colapsa (mesmo mecanismo do
  // "Recolher categorias" da Anual), a grade não deve se mover.
  await expect
    .poll(async () => {
      const controlsBox = await page
        .locator('[data-habit-controls-layout="desktop"]')
        .boundingBox();
      const frameBox = await habitsFrame.boundingBox();
      return controlsBox && frameBox
        ? Math.round(frameBox.y - (controlsBox.y + controlsBox.height))
        : null;
    })
    .toBe(12);
  await page.getByRole("button", { name: "Mostrar hábitos" }).click();
  await expect(habits.locator('[data-year-grid-surface="habits"]')).toBeVisible();
  const completedDay = habits.locator('[data-day-cell][data-day-iso$="-01-01"]');
  await expect(completedDay.locator("[data-habit-marker]")).toHaveCount(4);
  for (const stackPosition of [1, 2, 3, 4]) {
    await expect(
      completedDay.locator(`[data-habit-slot="stack-${stackPosition}"]`)
    ).toBeVisible();
  }
  const completedDayBox = await completedDay.boundingBox();
  if (!completedDayBox) throw new Error("Célula de hábitos não pôde ser medida.");
  expect(completedDayBox.height).toBeGreaterThanOrEqual(114);
  const markerGeometry = await completedDay.locator("[data-day-habit-markers]").evaluate(
    (element) => {
      const marker = element.querySelector<HTMLElement>("[data-habit-marker]");
      const style = getComputedStyle(element);
      return {
        direction: style.flexDirection,
        markerWidth: marker?.getBoundingClientRect().width ?? 0,
        markerGap: style.rowGap,
        markerRadius: marker
          ? Number.parseFloat(getComputedStyle(marker).borderRadius)
          : 0,
        dateBottom:
          element
            .closest("[data-day-cell]")
            ?.querySelector<HTMLElement>("[data-day-number]")
            ?.getBoundingClientRect().bottom ?? 0,
        firstMarkerTop: marker?.getBoundingClientRect().top ?? 0,
        markerBoxes: Array.from(
          element.querySelectorAll<HTMLElement>("[data-habit-marker]")
        ).map((entry) => {
          const box = entry.getBoundingClientRect();
          return { y: box.y, height: box.height };
        }),
      };
    }
  );
  expect(markerGeometry.direction).toBe("column");
  expect(markerGeometry.markerWidth).toBeGreaterThanOrEqual(12);
  expect(markerGeometry.markerWidth).toBeLessThanOrEqual(18);
  expect(markerGeometry.markerGap).toBe("2px");
  expect(markerGeometry.markerRadius).toBeGreaterThanOrEqual(
    markerGeometry.markerWidth / 2
  );
  expect(markerGeometry.firstMarkerTop - markerGeometry.dateBottom).toBeGreaterThanOrEqual(4);
  for (let index = 1; index < markerGeometry.markerBoxes.length; index += 1) {
    const previous = markerGeometry.markerBoxes[index - 1];
    const current = markerGeometry.markerBoxes[index];
    expect(current.y).toBeGreaterThanOrEqual(previous.y + previous.height + 1.5);
  }
  const habitsScrollViewport = habits.locator(
    "[data-desktop-habits-scroll-region]"
  );
  const habitsDock = habits.locator("[data-year-grid-dock]");
  const dockBoxAtTop = await habitsDock.boundingBox();
  const januaryBoxAtTop = await habits.locator('[data-month-row="0"]').boundingBox();
  const habitsViewportBox = await habitsScrollViewport.boundingBox();
  if (!dockBoxAtTop || !januaryBoxAtTop || !habitsViewportBox) {
    throw new Error("Grade e dock de hábitos não puderam ser medidos.");
  }
  expect(januaryBoxAtTop.y).toBeGreaterThanOrEqual(habitsViewportBox.y - 2);
  await habitsScrollViewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => habitsScrollViewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  const dockBoxAtBottom = await habitsDock.boundingBox();
  expect(dockBoxAtBottom).not.toBeNull();
  expect(Math.abs((dockBoxAtBottom?.y ?? 0) - dockBoxAtTop.y)).toBeLessThanOrEqual(1);
  await habitsScrollViewport.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect
    .poll(() => habitsScrollViewport.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(completedDay).toBeVisible();
  await completedDay.click();
  const dayPicker = page.locator("[data-habit-day-picker]");
  await expect(dayPicker).toBeVisible();
  const walkingChoice = dayPicker.getByRole("button", {
    name: "Desmarcar Caminhar",
  });
  await expect(walkingChoice).toBeFocused();
  const pickerBox = await dayPicker.boundingBox();
  const pickerViewport = page.viewportSize();
  if (!pickerBox || !pickerViewport) throw new Error("Seletor diário não pôde ser medido.");
  expect(pickerBox.x).toBeGreaterThanOrEqual(0);
  expect(pickerBox.y).toBeGreaterThanOrEqual(0);
  expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(pickerViewport.width);
  expect(pickerBox.y + pickerBox.height).toBeLessThanOrEqual(pickerViewport.height);
  await walkingChoice.click();
  await expect(completedDay.locator("[data-habit-marker]")).toHaveCount(3);
  await expect(completedDay.locator("[data-habit-marker]").first()).toHaveAttribute(
    "data-habit-marker",
    "habit-2"
  );
  await expect(completedDay.locator("[data-habit-marker]").first()).toHaveAttribute(
    "data-habit-slot",
    "stack-1"
  );
  await expect(dayPicker).toBeVisible();
  await dayPicker.getByRole("button", { name: "Marcar Caminhar" }).click();
  await expect(completedDay.locator("[data-habit-marker]")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(dayPicker).toHaveCount(0);
  await expect(completedDay).toBeFocused();

  const hiddenFilter = habits.getByRole("button", { name: "Alongar", exact: true });
  await hiddenFilter.click();
  await expect(hiddenFilter).toHaveAttribute("aria-pressed", "false");
  await expect(completedDay.locator("[data-habit-marker]")).toHaveCount(3);
  await expect.poll(async () => (await completedDay.boundingBox())?.height).toBe(94);
  await completedDay.click();
  await expect(
    page.locator("[data-habit-day-picker]").getByRole("button", {
      name: "Desmarcar Alongar",
    })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(async () => {
    const raw = await page.evaluate(() =>
      window.localStorage.getItem("doze52:habits-store:v1")
    );
    return JSON.parse(raw ?? "{}").state?.visibleHabitIds ?? [];
  }).not.toContain("habit-4");
  await expect(habits.locator('[data-day-cell][aria-disabled="true"]').first()).toBeVisible();
  await page.getByRole("link", { name: "Anual" }).click();
  await expect(calendarRegion).toBeVisible();
  await expect
    .poll(() => calendarRegion.evaluate((element) => element.scrollTop))
    .toBe(savedScrollTop);

  await profile.click();
  await panel.getByRole("button", { name: /^Conta/ }).click();
  await expect(panel.getByRole("button", { name: "Entrar com Google" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});

test("desktop restaura filtros de hábitos persistidos na sessão", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Cenário desktop");
  await installCompletedOnboarding(page);
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("doze52:habits-filter-seeded")) return;
    const habits = [
      { id: "visible", name: "Visível", color: "#2563eb", position: 0 },
      { id: "hidden", name: "Oculto", color: "#14b8a6", position: 1 },
    ].map((habit) => ({
      ...habit,
      icon: "circle-check",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));
    window.localStorage.setItem(
      "doze52:habits-store:v1",
      JSON.stringify({
        state: {
          habits,
          checkIns: {},
          selectedHabitId: "visible",
          visibleHabitIds: ["visible"],
        },
        version: 0,
      })
    );
    window.sessionStorage.setItem("doze52:habits-filter-seeded", "1");
  });
  await page.goto("/?surface=habits");
  await expect(page.getByRole("button", { name: "Visível", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByRole("button", { name: "Oculto", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Oculto", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
});

test("desktop mantém a grade anual disponível antes do primeiro hábito", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Cenário desktop");

  await installCompletedOnboarding(page);
  await page.goto("/?surface=habits");

  const habits = page.locator("[data-habits-prototype]");
  await expect(habits.locator('[data-year-grid-surface="habits"]')).toBeVisible();
  await expect(habits.getByRole("button", { name: "Criar novo hábito" })).toBeVisible();

  const emptyDay = habits.locator('[data-day-cell][aria-label*="crie um hábito"]:not([aria-disabled="true"])').first();
  await emptyDay.click();
  await expect(page.getByRole("dialog", { name: "Novo hábito" })).toBeVisible();
  const habitNameInput = page.getByLabel("Nome do hábito");
  await expect(habitNameInput).toHaveAttribute(
    "placeholder",
    "Caminhar, treinar, estudar, meditar, correr, ler…"
  );
  await expect(page.getByText(/Para se inspirar:/)).toHaveCount(0);
  await habitNameInput.fill("Ler");
  await page.getByRole("button", { name: "Criar hábito" }).click();
  await expect(habits.getByRole("button", { name: "Ler", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(emptyDay.locator("[data-habit-marker]")).toHaveCount(0);
  await expect(habits.locator('[data-day-cell][aria-disabled="true"]').first()).toBeVisible();
});

test("desktop edita e reordena hábitos nos controles contextuais", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Cenário desktop");

  await installCompletedOnboarding(page);
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("doze52:habits-edit-seeded")) return;
    const habits = [
      { id: "habit-a", name: "Caminhar", color: "#2563eb", position: 0 },
      { id: "habit-b", name: "Ler", color: "#14b8a6", position: 1 },
    ].map((habit, index) => ({
      ...habit,
      icon: "circle-check",
      createdAt: `2026-01-0${index + 1}T00:00:00.000Z`,
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));
    window.localStorage.setItem(
      "doze52:habits-store:v1",
      JSON.stringify({
        state: {
          habits,
          checkIns: {},
          selectedHabitId: "habit-a",
          visibleHabitIds: habits.map((habit) => habit.id),
        },
        version: 0,
      })
    );
    window.sessionStorage.setItem("doze52:habits-edit-seeded", "1");
  });
  await page.goto("/?surface=habits");

  // Editar hábitos agora vive dentro do painel Organizar (modal); os
  // controles de reordenar/editar ficam em [data-filter-edit-panel], não
  // mais na faixa sempre visível [data-habit-controls-layout="desktop"].
  const controls = page.locator("[data-filter-edit-panel]");
  const edit = page.getByRole("button", { name: "Organizar", exact: true });
  await edit.click();
  const organizePanel = page.getByRole("dialog", { name: "Organizar" });
  await expect(organizePanel).toBeVisible();
  await expect(page.locator('[data-day-cell][aria-disabled="true"]').first()).toBeVisible();

  const reorderCaminhar = controls.getByRole("button", { name: "Reordenar hábito Caminhar" });
  const reorderLer = controls.getByRole("button", { name: "Reordenar hábito Ler" });
  const sourceBox = await reorderCaminhar.boundingBox();
  const targetBox = await reorderLer.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Alças de hábitos não puderam ser medidas.");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => {
    const raw = await page.evaluate(() =>
      window.localStorage.getItem("doze52:habits-store:v1")
    );
    return [...(JSON.parse(raw ?? "{}").state?.habits ?? [])]
      .sort((left, right) => left.position - right.position)
      .map((habit) => habit.id)
      .join(",");
  }).toBe("habit-b,habit-a");
  await page.waitForTimeout(300);
  await controls.getByRole("button", { name: "Editar hábito Caminhar" }).click();
  await page.getByLabel("Nome do hábito").fill("Corrida");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(controls.getByRole("button", { name: "Editar hábito Corrida" })).toBeVisible();

  await controls.getByRole("button", { name: "Editar hábito Ler" }).click();
  await page.getByRole("button", { name: "Excluir hábito" }).click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(controls.getByRole("button", { name: "Editar hábito Ler" })).toHaveCount(0);
  await expect(controls.getByRole("button", { name: "Editar hábito Corrida" })).toBeVisible();

  // O painel Organizar é modal e deixa o resto da página inacessível
  // enquanto aberto — precisa fechar antes de mexer no ano no plano de fundo.
  await page.keyboard.press("Escape");
  await expect(organizePanel).toBeHidden();

  const currentYear = new Date().getFullYear();
  const yearStepper = page.locator("[data-calendar-year-stepper]");
  await yearStepper.getByRole("button", { name: `Avançar para ${currentYear + 1}` }).click();
  await expect(yearStepper.getByLabel(`Ano ${currentYear + 1}`)).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-habit-controls-layout="desktop"]')).toContainText("Corrida");
});

test("mobile reordena hábitos pelo mesmo DnD e persiste a posição", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "Cenário mobile");

  await installCompletedOnboarding(page);
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("doze52:habits-mobile-dnd-seeded")) return;
    const habits = [
      { id: "mobile-a", name: "Caminhar", color: "#2563eb", position: 0 },
      { id: "mobile-b", name: "Ler", color: "#14b8a6", position: 1 },
    ].map((habit, index) => ({
      ...habit,
      icon: "circle-check",
      createdAt: `2026-01-0${index + 1}T00:00:00.000Z`,
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));
    window.localStorage.setItem(
      "doze52:habits-store:v1",
      JSON.stringify({
        state: {
          habits,
          checkIns: {},
          selectedHabitId: "mobile-a",
          visibleHabitIds: habits.map((habit) => habit.id),
        },
        version: 0,
      })
    );
    window.sessionStorage.setItem("doze52:habits-mobile-dnd-seeded", "1");
  });
  await page.goto("/?surface=habits");

  const controls = page.locator('[data-habit-controls-layout="mobile"]');
  // O gatilho de edição foi unificado com o do Anual ("Organizar") e vive no
  // cabeçalho (components/app-header.tsx), não mais dentro dos próprios
  // controles de Hábitos como um botão "Editar" separado.
  await page.getByRole("button", { name: "Organizar", exact: true }).click();
  const handle = controls.getByRole("button", { name: "Reordenar hábito Caminhar" });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  // A grade de edição (habit-edit-list.tsx) é sempre multi-coluna
  // (grid-cols-2, ou 3 a partir de 430px) — com só 2 hábitos seedados aqui,
  // os dois ficam sempre lado a lado na mesma linha em qualquer largura, e
  // "ArrowRight" é a direção que o dnd-kit reconhece pra trocar de posição.
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  await page.keyboard.press("Space");

  await expect.poll(async () => {
    const raw = await page.evaluate(() =>
      window.localStorage.getItem("doze52:habits-store:v1")
    );
    const store = JSON.parse(raw ?? "{}");
    return [...(store.state?.habits ?? [])]
      .sort((left, right) => left.position - right.position)
      .map((habit) => habit.id)
      .join(",");
  }).toBe("mobile-b,mobile-a");

  await page.reload();
  await page.getByRole("button", { name: "Organizar", exact: true }).click();
  const chips = controls.locator("[data-habit-edit-chip]");
  await expect(chips.first()).toHaveAttribute("data-habit-edit-chip", "mobile-b");
  await controls.getByRole("button", { name: "Editar hábito Caminhar" }).click();
  await page.getByLabel("Nome do hábito").fill("Caminhar mobile");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await controls.getByRole("button", { name: "Editar hábito Ler" }).click();
  await page.getByRole("button", { name: "Excluir hábito" }).click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(controls.getByRole("button", { name: "Editar hábito Ler" })).toHaveCount(0);
  await expect(
    controls.getByRole("button", { name: "Editar hábito Caminhar mobile" })
  ).toBeVisible();
});

test("onboarding desktop apresenta o exemplo e termina no hábito real", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Cenário desktop");

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({
        version: 13,
        step: "period_navigation_instruction",
        context: "personal",
        startedAt: new Date().toISOString(),
        dateItemsCreated: 2,
        periodItemsCreated: 2,
        holidayCalendarAddedAt: new Date().toISOString(),
      })
    );
    window.localStorage.removeItem("doze52:habits-store:v1");
  });
  await page.goto("/?surface=annual");

  const periodNotice = page.locator(
    '[data-guided-toolbar-notice][data-guided-toolbar-target="period-navigation"]'
  );
  await expect(periodNotice).toBeVisible();
  await expect(page.locator('[data-onboarding-period-control="true"]')).toHaveCount(4);
  await expect(page.locator('[data-onboarding-period-outline="true"]')).toHaveCount(1);
  await expect(page.locator(".product-spotlight-target")).toHaveCount(0);
  const periodNoticeBox = await periodNotice.boundingBox();
  const periodAnchorBox = await page.locator("[data-onboarding-period-anchor]").boundingBox();
  expect(periodNoticeBox).not.toBeNull();
  expect(periodAnchorBox).not.toBeNull();
  expect(Math.abs((periodNoticeBox?.y ?? 0) + (periodNoticeBox?.height ?? 0) / 2 - ((periodAnchorBox?.y ?? 0) + (periodAnchorBox?.height ?? 0) / 2))).toBeLessThan(24);
  await page.getByTitle("1o trimestre").click();
  await expect(page.locator("[data-month-row]")).toHaveCount(3);
  await page.getByTitle("Abrir Janeiro").click();
  await expect(page.locator("[data-month-row]")).toHaveCount(1);
  await expect(page.locator('[data-onboarding-period-outline="true"]')).toHaveCount(0);
  await periodNotice.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("[data-month-row]")).toHaveCount(12);
  await expect(page.locator('[data-product-navigation="desktop"] a[aria-current="page"]')).toHaveAttribute("title", "Anual");
  const habitSurfaceNotice = page.locator(
    '[data-guided-toolbar-notice][data-guided-toolbar-target="habit-surface"]'
  );
  await expect(habitSurfaceNotice).toBeVisible();
  const habitsDestination = page.locator(
    '[data-product-navigation="desktop"] [data-product-destination="habits"]'
  );
  await expect(habitsDestination).toHaveAttribute(
    "data-onboarding-highlighted",
    "true"
  );
  await expect(habitsDestination).toHaveClass(/product-spotlight-target/);
  await expect(habitsDestination).toHaveCSS("box-shadow", "none");
  await expect(habitsDestination).toHaveCSS("outline-style", "none");
  const guidedCurrentYear = new Date().getFullYear();
  await page
    .locator(`button[title="Avançar para ${guidedCurrentYear + 1}"]:visible`)
    .first()
    .click();
  await expect(
    page.locator(`button[aria-label*="Ano ${guidedCurrentYear + 1}"]:visible`).first()
  ).toBeVisible();
  await page.locator('button[title="Abrir Janeiro"]:visible').first().click();
  await expect(page.locator("[data-month-row]")).toHaveCount(1);
  await habitsDestination.click();
  await expect(page.locator('[data-product-navigation="desktop"] a[aria-current="page"]')).toHaveAttribute("title", "Hábitos");
  await expect(page.locator('[data-calendar-year-stepper]:visible button[aria-live="polite"]').first()).toHaveText(
    String(guidedCurrentYear)
  );
  await expect(page.locator("[data-month-row]")).toHaveCount(12);
  // O passo isolado de vitrine travada ("habit-showcase") foi removido: a
  // vitrine de exemplo (Exercício, Ler 20 minutos) já compõe o ano real
  // desde o primeiro instante em Hábitos, lado a lado com a criação do
  // hábito de verdade (ver commit "Refina onboarding guiado", #95).
  const habitNotice = page.locator(
    '[data-guided-toolbar-notice][data-guided-toolbar-target="habit"]'
  );
  await expect(habitNotice).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exercício", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Ler 20 minutos", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() => {
      const stored = JSON.parse(
        window.localStorage.getItem("doze52:habits-store:v1") ?? "{}"
      );
      return (stored.state?.habits ?? []).length;
    })
  ).toBe(0);
  const habitCreate = page.locator('[data-onboarding-habit-create="true"]');
  const habitNoticeBox = await habitNotice.boundingBox();
  const habitCreateBox = await habitCreate.boundingBox();
  expect(habitNoticeBox).not.toBeNull();
  expect(habitCreateBox).not.toBeNull();
  expect(Math.abs((habitNoticeBox?.x ?? 0) + (habitNoticeBox?.width ?? 0) / 2 - ((habitCreateBox?.x ?? 0) + (habitCreateBox?.width ?? 0) / 2))).toBeLessThan(24);
  await page.getByRole("button", { name: "Criar novo hábito" }).click();
  await page.getByLabel("Nome do hábito").fill("Leitura");
  await page.getByRole("button", { name: "Criar hábito" }).click();

  const createdNotice = page.locator(
    '[data-guided-toolbar-notice][data-guided-toolbar-target="habit-created"]'
  );
  await expect(createdNotice).toContainText("duas últimas semanas");
  const retrospectiveDates = page.locator(
    '[data-onboarding-retrospective-date="true"]'
  );
  await expect(retrospectiveDates).toHaveCount(14);
  await expect(
    page.locator('[data-onboarding-retrospective-highlighted="true"]')
  ).toHaveCount(14);
  // O card ancora perto de "hoje" (o dia que a pessoa reconhece de cara),
  // não do meio das duas semanas de retrospectiva — ver
  // components/habits/desktop-habits-prototype.tsx (anchorSelector aponta
  // para `[data-day-iso="${todayIso}"]`). Como getHabitRetrospectiveDates
  // devolve as datas em ordem crescente, o último item da lista é hoje.
  const todayCellBox = await retrospectiveDates.last().boundingBox();
  if (!todayCellBox) throw new Error("Dia de hoje não pôde ser medido.");
  const createdNoticeBox = await createdNotice.boundingBox();
  if (!createdNoticeBox) throw new Error("Card retrospectivo não pôde ser medido.");
  const verticalDistance = Math.min(
    Math.abs(createdNoticeBox.y + createdNoticeBox.height - todayCellBox.y),
    Math.abs(createdNoticeBox.y - (todayCellBox.y + todayCellBox.height))
  );
  expect(verticalDistance).toBeLessThanOrEqual(16);
  await retrospectiveDates.last().click();
  await expect(
    page.locator('[data-onboarding-retrospective-highlighted="true"]')
  ).toHaveCount(0);
  await expect(createdNotice).toBeVisible();
  // Encerrar o hábito não fecha mais o guia direto: agora ele segue pelo
  // tema e pelo resumo (wrap-up) antes de terminar, igual ao restante do
  // tour guiado (ver "finish_habit_onboarding" em lib/onboarding.ts).
  await createdNotice.getByRole("button", { name: "Continuar" }).click();

  const themeNotice = page
    .locator('[data-guided-toolbar-notice][data-guided-toolbar-target="theme"]:visible')
    .first();
  await expect(themeNotice).toBeVisible();
  await page.locator("[data-onboarding-theme-control]:visible").first().click();
  await themeNotice.getByRole("button", { name: "Continuar" }).click();

  const wrapUpNotice = page
    .locator('[data-guided-toolbar-notice][data-guided-toolbar-target="wrap-up"]:visible')
    .first();
  await expect(wrapUpNotice).toBeVisible();
  await page.locator('[data-product-organize="desktop"]').click();
  await wrapUpNotice.getByRole("button", { name: "Finalizar guia" }).click();

  await expect(
    page.locator('[data-product-navigation="desktop"] a[aria-current="page"]')
  ).toHaveAttribute("title", "Anual");
  await expect(
    page.locator('[data-guided-toolbar-target="profile"]')
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const onboarding = JSON.parse(
        window.localStorage.getItem("doze52:onboarding:v2") ?? "{}"
      );
      const habitsStore = JSON.parse(
        window.localStorage.getItem("doze52:habits-store:v1") ?? "{}"
      );
      const habits = habitsStore.state ?? {};
      return {
        step: onboarding.step,
        habitCount: (habits.habits ?? []).length,
        checkInCount: Object.keys(habits.checkIns ?? {}).length,
      };
    })
  ).toMatchObject({ step: "completed", habitCount: 1, checkInCount: 1 });
});

test("onboarding mantém a edição aberta até importar o calendário", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Cenário desktop");
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({
        version: 14,
        step: "edit_instruction",
        context: "personal",
        startedAt: new Date().toISOString(),
        dateItemsCreated: 2,
        periodItemsCreated: 2,
      })
    );
  });
  await page.goto("/?surface=annual");

  const edit = page.locator('[data-product-organize="desktop"]');
  const editNotice = page.locator(
    '[data-guided-toolbar-notice][data-guided-toolbar-target="edit"]'
  );
  await expect(editNotice).toBeVisible();
  await expect(editNotice).toHaveCSS("position", "fixed");
  const editBox = await edit.boundingBox();
  const editNoticeBox = await editNotice.boundingBox();
  const viewport = page.viewportSize();
  if (!editBox || !editNoticeBox || !viewport) {
    throw new Error("Orientação do modo de edição não pôde ser medida.");
  }
  expect(editNoticeBox.x).toBeGreaterThanOrEqual(-0.5);
  expect(editNoticeBox.x + editNoticeBox.width).toBeLessThanOrEqual(
    viewport.width + 0.5
  );
  expect(
    await editNotice.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      return Boolean(hit && element.contains(hit));
    })
  ).toBe(true);
  await edit.click();
  await expect(edit).toHaveAttribute("aria-label", /Finalizar organização/);
  await expect(
    page.locator(
      '[data-guided-toolbar-notice][data-guided-toolbar-target="calendars"]'
    )
  ).toBeVisible();
  // O botão fica com a aparência original (sem destaque de fundo/anel) —
  // a posição do card, ancorado nele, já deixa claro qual usar.
  const calendarTarget = page.locator('[data-onboarding-calendar-control]');
  await expect(calendarTarget).toBeVisible();
  await expect(calendarTarget).not.toHaveClass(/product-spotlight-target/);

  await page.locator("[data-onboarding-calendar-control]").click();
  const choice = page.getByRole("dialog", { name: "Adicionar categoria" });
  const readyCalendarOption = choice.getByRole("button", {
    name: /Adicionar calendário pronto/,
  });
  await expect(readyCalendarOption).toHaveAttribute(
    "data-onboarding-calendar-choice",
    "true"
  );
  // Cartão original (mesmo componente do vizinho "Criar minha categoria"),
  // só com a borda mais grossa para sugerir "é este".
  await expect(readyCalendarOption).toHaveClass(/border-2/);
  await choice
    .getByRole("button", { name: /Adicionar calendário pronto/ })
    .click();
  const gallery = page.getByRole("dialog", { name: "Calendários" });
  const nationalStateCard = gallery
    .locator("[data-calendar-pack-group]")
    .filter({ hasText: "Feriados nacionais + estaduais" });
  await expect(nationalStateCard).toBeVisible();
  await nationalStateCard
    .getByRole("button", { name: "Adicionar feriados" })
    .click();

  await expect(
    page.locator(
      '[data-guided-toolbar-notice][data-guided-toolbar-target="period-navigation"]'
    )
  ).toBeVisible();
  await expect(edit).toHaveAttribute("aria-label", /^Organizar/);
});

test("demonstração não apaga um hábito real já existente", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Cenário desktop");
  await page.addInitScript(() => {
    const timestamp = new Date().toISOString();
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({
        version: 14,
        step: "habit_surface_instruction",
        context: "personal",
        startedAt: timestamp,
      })
    );
    window.localStorage.setItem(
      "doze52:habits-store:v1",
      JSON.stringify({
        state: {
          habits: [
            {
              id: "real-habit",
              name: "Meu hábito preservado",
              color: "#4F8FD6",
              icon: "circle-check",
              position: 0,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
          checkIns: {},
          selectedHabitId: "real-habit",
          visibleHabitIds: ["real-habit"],
        },
        version: 0,
      })
    );
  });
  await page.goto("/?surface=annual");
  await page
    .locator('[data-product-navigation="desktop"] [data-product-destination="habits"]')
    .click();
  // Já existindo um hábito real, a jornada pula direto para a confirmação
  // (não há mais um passo isolado de vitrine travada — ver
  // "open_habits_surface" em lib/onboarding.ts).
  await expect(
    page.getByRole("button", { name: "Meu hábito preservado", exact: true })
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-guided-toolbar-notice][data-guided-toolbar-target="habit-created"]'
    )
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      const stored = JSON.parse(
        window.localStorage.getItem("doze52:habits-store:v1") ?? "{}"
      );
      return stored.state?.habits?.map((habit: { id: string }) => habit.id);
    })
  ).toEqual(["real-habit"]);
});

test("sessão v13 em Perfil é tratada como concluída", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Cenário desktop");

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({
        version: 13,
        step: "profile_instruction",
        context: "personal",
        startedAt: new Date().toISOString(),
      })
    );
  });
  await page.goto("/?surface=annual");
  await expect(
    page.locator("[data-guided-toolbar-notice]")
  ).toHaveCount(0);
  await expect(page.locator("[data-onboarding-panel]")).toHaveCount(0);
});
