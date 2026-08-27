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
    if (!window.sessionStorage.getItem("doze52:habits-e2e:initialized")) {
      window.sessionStorage.removeItem("doze52:habits-prototype:v1");
      window.sessionStorage.setItem("doze52:habits-e2e:initialized", "1");
    }
  });
};

const expectCenteredLogo = async (
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
  expect(Math.abs(logoBox.x + logoBox.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
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
    window.sessionStorage.removeItem("doze52:habits-prototype:v1");
  });
  await page.goto("/?surface=annual");

  const onboardingPanel = page.locator(
    '[data-guided-onboarding-step="context_selection"]'
  );
  await expect(onboardingPanel).toContainText(
    "Por qual contexto você quer começar?"
  );
  await page.getByRole("link", { name: "Hábitos" }).click();

  const habits = page.locator("[data-habits-prototype]");
  await expect(habits).toBeVisible();
  for (const name of [
    "Exercício",
    "Ler 20 minutos",
    "Dormir antes das 23h",
    "Dia sem fumar",
  ]) {
    await expect(habits.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(
    habits.getByRole("button", { name: "Dia sem fumar", exact: true })
  ).toHaveAttribute("aria-pressed", "false");
  const habitDay = habits.locator("[data-day-cell]").first();
  await expect.poll(async () => (await habitDay.boundingBox())?.height).toBe(80);
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
  await expect(page.locator("[data-calendar-year-stepper]:visible span").first()).toHaveText(
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
  await expectCenteredLogo(page);

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

  const sessionAfterCreation = await page.evaluate(() =>
    window.sessionStorage.getItem("doze52:habits-prototype:v1")
  );
  expect(sessionAfterCreation).not.toBeNull();
  expect(Object.keys(JSON.parse(sessionAfterCreation ?? "{}").checkIns ?? {})).toHaveLength(0);

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
  await utilityPanel.getByRole("button", { name: /^Conta/ }).click();
  await utilityPanel.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Entrar" })).toBeVisible();
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
    window.sessionStorage.setItem(
      "doze52:habits-prototype:v1",
      JSON.stringify({ habits, checkIns, selectedHabitId: "habit-1" })
    );
    window.sessionStorage.setItem("doze52:habits-desktop-seeded", "1");
  });
  await page.goto("/");
  const desktopNavigation = page.locator('[data-product-navigation="desktop"]');
  await expect(desktopNavigation).toBeVisible();
  await expect(desktopNavigation.getByRole("link", { name: "Anual" })).toHaveClass(/text-foreground/);
  await expect(desktopNavigation.getByRole("link", { name: "Anual" })).not.toHaveClass(/bg-foreground/);
  await expectCenteredLogo(page);
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
  const contextualEdit = page.getByRole("button", { name: "Editar", exact: true });
  const collapseCategories = page.getByRole("button", { name: "Recolher categorias" });
  const contextualEditBox = await contextualEdit.boundingBox();
  const collapseBox = await collapseCategories.boundingBox();
  if (!contextualEditBox || !collapseBox) throw new Error("Controles contextuais não puderam ser medidos.");
  expect(contextualEditBox.x).toBeLessThan(collapseBox.x);
  await expect(page.locator("[data-calendar-scale-control]")).toHaveCount(0);
  const scaleBox = await page.locator("[data-calendar-footer-center]").boundingBox();
  if (!scaleBox || !desktopViewport) throw new Error("Escala não pôde ser medida.");
  expect(Math.abs(scaleBox.x + scaleBox.width / 2 - desktopViewport.width / 2)).toBeLessThanOrEqual(2);
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
    .filter({ hasText: "Jogos do Grêmio" });
  await defaultTeamCard.getByRole("button", { name: "Adicionar calendário" }).click();
  await expect(defaultTeamCard.getByText("Meu ano", { exact: true })).toBeVisible();
  await calendarGallery.getByRole("button", { name: "Voltar para as opções de categoria" }).click();
  await expect(categoryChoice).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finalizar edição" }).click();
  const categoryRegion = page.locator("#app-header-categories");
  await collapseCategories.click();
  await expect(categoryRegion).toHaveAttribute("aria-hidden", "true");
  await expect(categoryRegion).toHaveCount(1);
  await page.getByRole("button", { name: "Mostrar categorias" }).click();
  await expect(categoryRegion).toHaveAttribute("aria-hidden", "false");

  const calendarControlSpacing = await page
    .locator("[data-onboarding-filter-region]")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        maxWidth: style.maxWidth,
        paddingTop: style.paddingTop,
        rowGap: style.rowGap,
      };
    });

  const calendarRegion = page.locator("[data-desktop-calendar-scroll-region]");
  const widthBefore = (await calendarRegion.boundingBox())?.width;
  await expect(page.getByRole("button", { name: "Abrir configurações" })).toHaveCount(0);
  await profile.click();
  const panel = page.locator("[data-app-utility-panel]");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("data-desktop-anchor-positioned", "true");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport desktop indisponível.");
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(
    Math.min(880, viewport.width - 80)
  );
  const panelBox = await panel.boundingBox();
  const profileTriggerBox = await profile.boundingBox();
  if (!panelBox || !profileTriggerBox) {
    throw new Error("Perfil e painel não puderam ser medidos.");
  }
  expect(
    Math.abs(
      panelBox.x + panelBox.width -
        (profileTriggerBox.x + profileTriggerBox.width)
    )
  ).toBeLessThanOrEqual(16);
  expect(panelBox.y).toBeLessThanOrEqual(
    profileTriggerBox.y + profileTriggerBox.height + 9
  );
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(viewport.height - 15);
  expect((await calendarRegion.boundingBox())?.width).toBe(widthBefore);
  await expect(panel.getByText("Aparência", { exact: true })).toBeVisible();
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
  expect(completedDayBox.height).toBeGreaterThanOrEqual(98);
  const markerGeometry = await completedDay.locator("[data-day-habit-markers]").evaluate(
    (element) => {
      const marker = element.querySelector<HTMLElement>("[data-habit-marker]");
      const style = getComputedStyle(element);
      return {
        direction: style.flexDirection,
        markerWidth: marker?.getBoundingClientRect().width ?? 0,
        markerGap: style.rowGap,
        markerRadius: marker ? getComputedStyle(marker).borderRadius : "",
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
  expect(markerGeometry.markerGap).toBe("normal");
  expect(markerGeometry.markerRadius).not.toBe("9999px");
  for (let index = 1; index < markerGeometry.markerBoxes.length; index += 1) {
    const previous = markerGeometry.markerBoxes[index - 1];
    const current = markerGeometry.markerBoxes[index];
    expect(current.y).toBeGreaterThanOrEqual(previous.y + previous.height - 0.5);
  }
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
  await expect.poll(async () => (await completedDay.boundingBox())?.height).toBe(80);
  await completedDay.click();
  await expect(
    page.locator("[data-habit-day-picker]").getByRole("button", {
      name: "Desmarcar Alongar",
    })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(async () => {
    const raw = await page.evaluate(() =>
      window.sessionStorage.getItem("doze52:habits-prototype:v1")
    );
    return JSON.parse(raw ?? "{}").visibleHabitIds ?? [];
  }).not.toContain("habit-4");
  await expect(habits.locator('[data-day-cell][aria-disabled="true"]').first()).toBeVisible();
  await page.getByRole("link", { name: "Anual" }).click();
  await expect(calendarRegion).toBeVisible();
  await expect
    .poll(() => calendarRegion.evaluate((element) => element.scrollTop))
    .toBe(savedScrollTop);

  await profile.click();
  await panel.getByRole("button", { name: /^Conta/ }).click();
  await panel.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Entrar" })).toBeVisible();
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
    window.sessionStorage.setItem(
      "doze52:habits-prototype:v1",
      JSON.stringify({
        habits,
        checkIns: {},
        selectedHabitId: "visible",
        visibleHabitIds: ["visible"],
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
  await expect(page.getByText(/Para se inspirar: caminhar, correr/)).toBeVisible();
  await page.getByLabel("Nome do hábito").fill("Ler");
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
    window.sessionStorage.setItem(
      "doze52:habits-prototype:v1",
      JSON.stringify({ habits, checkIns: {}, selectedHabitId: "habit-a" })
    );
    window.sessionStorage.setItem("doze52:habits-edit-seeded", "1");
  });
  await page.goto("/?surface=habits");

  const controls = page.locator('[data-habit-controls-layout="desktop"]');
  const edit = controls.getByRole("button", { name: "Editar", exact: true });
  await edit.click();
  await expect(controls.getByRole("button", { name: "Finalizar edição" })).toBeVisible();
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
      window.sessionStorage.getItem("doze52:habits-prototype:v1")
    );
    return [...(JSON.parse(raw ?? "{}").habits ?? [])]
      .sort((left, right) => left.position - right.position)
      .map((habit) => habit.id)
      .join(",");
  }).toBe("habit-b,habit-a");
  await page.waitForTimeout(300);
  await controls.getByRole("button", { name: "Editar hábito Caminhar" }).click();
  await page.getByLabel("Nome do hábito").fill("Corrida");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(controls.getByRole("button", { name: "Editar hábito Corrida" })).toBeVisible();

  await controls.getByRole("button", { name: "Editar hábito Corrida" }).click();
  await page.getByRole("button", { name: "Arquivar" }).click();
  await controls.getByRole("button", { name: "Editar hábito Ler" }).click();
  await page.getByRole("button", { name: "Arquivar" }).click();
  await controls.getByRole("button", { name: "Corrida", exact: true }).click();
  await expect(controls.getByRole("button", { name: "Editar hábito Corrida" })).toBeVisible();

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
    window.sessionStorage.setItem(
      "doze52:habits-prototype:v1",
      JSON.stringify({ habits, checkIns: {}, selectedHabitId: "mobile-a" })
    );
    window.sessionStorage.setItem("doze52:habits-mobile-dnd-seeded", "1");
  });
  await page.goto("/?surface=habits");

  const controls = page.locator('[data-habit-controls-layout="mobile"]');
  await controls.getByRole("button", { name: "Editar", exact: true }).click();
  const handle = controls.getByRole("button", { name: "Reordenar hábito Caminhar" });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  await page.keyboard.press(
    testInfo.project.name === "mobile-430" ? "ArrowRight" : "ArrowDown"
  );
  await page.waitForTimeout(100);
  await page.keyboard.press("Space");

  await expect.poll(async () => {
    const raw = await page.evaluate(() =>
      window.sessionStorage.getItem("doze52:habits-prototype:v1")
    );
    const session = JSON.parse(raw ?? "{}");
    return [...(session.habits ?? [])]
      .sort((left, right) => left.position - right.position)
      .map((habit) => habit.id)
      .join(",");
  }).toBe("mobile-b,mobile-a");

  await page.reload();
  await controls.getByRole("button", { name: "Editar", exact: true }).click();
  const chips = controls.locator("[data-habit-edit-chip]");
  await expect(chips.first()).toHaveAttribute("data-habit-edit-chip", "mobile-b");
  await controls.getByRole("button", { name: "Editar hábito Caminhar" }).click();
  await page.getByLabel("Nome do hábito").fill("Caminhar mobile");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await controls.getByRole("button", { name: "Editar hábito Caminhar mobile" }).click();
  await page.getByRole("button", { name: "Arquivar" }).click();
  await controls.getByRole("button", { name: "Editar hábito Ler" }).click();
  await page.getByRole("button", { name: "Arquivar" }).click();
  await controls.getByRole("button", { name: "Caminhar mobile", exact: true }).click();
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
        step: "year_instruction",
        context: "personal",
        startedAt: new Date().toISOString(),
        dateItemsCreated: 2,
        periodItemsCreated: 2,
      })
    );
    window.sessionStorage.removeItem("doze52:habits-prototype:v1");
  });
  await page.goto("/?surface=annual");

  const yearNotice = page.locator(
    '[data-guided-toolbar-notice][data-guided-toolbar-target="year"]'
  );
  await expect(yearNotice).toContainText("Aqui você troca o ano.");
  const visibleYearStepper = page.locator("[data-calendar-year-stepper]:visible");
  const guidedYearControls = visibleYearStepper.locator(":scope > button");
  expect(
    await guidedYearControls.evaluateAll((controls) =>
      controls.length > 0 &&
      controls.every((control) => (control as HTMLButtonElement).disabled)
    )
  ).toBe(true);
  const guidedYear = await visibleYearStepper.locator("span").first().textContent();
  await yearNotice.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.locator("[data-calendar-year-stepper]:visible span").first()
  ).toHaveText(guidedYear ?? "");
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
  await expect(page.locator("[data-guided-target-outline]")).toHaveCount(1);
  const guidedCurrentYear = new Date().getFullYear();
  await page.getByTitle(`Avançar para ${guidedCurrentYear + 1}`).click();
  await expect(page.getByLabel(`Ano ${guidedCurrentYear + 1}`)).toBeVisible();
  await page.locator('button[title="Abrir Janeiro"]:visible').first().click();
  await expect(page.locator("[data-month-row]")).toHaveCount(1);
  await habitsDestination.click();
  await expect(page.locator('[data-product-navigation="desktop"] a[aria-current="page"]')).toHaveAttribute("title", "Hábitos");
  await expect(page.locator("[data-calendar-year-stepper]:visible span").first()).toHaveText(
    String(guidedCurrentYear)
  );
  await expect(page.locator("[data-month-row]")).toHaveCount(12);
  const showcaseNotice = page.locator(
    '[data-guided-toolbar-notice][data-guided-toolbar-target="habit-showcase"]'
  );
  await expect(showcaseNotice).toBeVisible();
  for (const name of [
    "Exercício",
    "Ler 20 minutos",
    "Dormir antes das 23h",
    "Dia sem fumar",
  ]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Exercício", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Ler 20 minutos", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Dormir antes das 23h", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  const smokeFilter = page.getByRole("button", {
    name: "Dia sem fumar",
    exact: true,
  });
  await expect(smokeFilter).toHaveAttribute("aria-pressed", "false");
  const showcaseDay = page.locator("[data-day-cell]").first();
  await expect.poll(async () => (await showcaseDay.boundingBox())?.height).toBe(80);
  expect(
    await page.locator("[data-day-habit-markers]").evaluateAll((markers) =>
      markers.some(
        (marker) => marker.querySelectorAll("[data-habit-marker]").length === 4
      )
    )
  ).toBe(false);
  await smokeFilter.click();
  await expect(smokeFilter).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await showcaseDay.boundingBox())?.height).toBe(98);
  expect(
    await page.locator("[data-day-habit-markers]").evaluateAll((markers) =>
      markers.some(
        (marker) => marker.querySelectorAll("[data-habit-marker]").length === 4
      )
    )
  ).toBe(true);
  expect(
    await page.evaluate(() => {
      const stored = JSON.parse(
        window.sessionStorage.getItem("doze52:habits-prototype:v1") ?? "{}"
      );
      return (stored.habits ?? []).length;
    })
  ).toBe(0);
  await showcaseNotice.getByRole("button", { name: "Criar meu hábito" }).click();

  const habitNotice = page.locator(
    '[data-guided-toolbar-notice][data-guided-toolbar-target="habit"]'
  );
  await expect(habitNotice).toBeVisible();
  await expect(page.getByRole("button", { name: "Exercício", exact: true })).toHaveCount(0);
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
  const retrospectiveBounds = await retrospectiveDates.evaluateAll((nodes) => {
    const rects = nodes.map((node) => node.getBoundingClientRect());
    return {
      left: Math.min(...rects.map((rect) => rect.left)),
      top: Math.min(...rects.map((rect) => rect.top)),
      right: Math.max(...rects.map((rect) => rect.right)),
      bottom: Math.max(...rects.map((rect) => rect.bottom)),
    };
  });
  const createdNoticeBox = await createdNotice.boundingBox();
  if (!createdNoticeBox) throw new Error("Card retrospectivo não pôde ser medido.");
  const verticalDistance = Math.min(
    Math.abs(createdNoticeBox.y + createdNoticeBox.height - retrospectiveBounds.top),
    Math.abs(createdNoticeBox.y - retrospectiveBounds.bottom)
  );
  expect(verticalDistance).toBeLessThanOrEqual(16);
  await retrospectiveDates.last().click();
  await expect(
    page.locator('[data-onboarding-retrospective-highlighted="true"]')
  ).toHaveCount(0);
  await expect(createdNotice).toBeVisible();
  await createdNotice.getByRole("button", { name: "Finalizar guia" }).click();
  await expect(
    page.locator('[data-product-navigation="desktop"] a[aria-current="page"]')
  ).toHaveAttribute("title", "Hábitos");
  await expect(
    page.locator('[data-guided-toolbar-target="profile"]')
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const onboarding = JSON.parse(
        window.localStorage.getItem("doze52:onboarding:v2") ?? "{}"
      );
      const habits = JSON.parse(
        window.sessionStorage.getItem("doze52:habits-prototype:v1") ?? "{}"
      );
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

  const edit = page.locator("[data-onboarding-edit-control]");
  await edit.click();
  await expect(edit).toHaveAttribute("aria-label", /Finalizar edição/);
  await expect(
    page.locator(
      '[data-guided-toolbar-notice][data-guided-toolbar-target="calendars"]'
    )
  ).toBeVisible();
  const calendarTarget = page.locator(
    '[data-onboarding-calendar-control][data-onboarding-highlighted="true"]'
  );
  const targetOutline = page.locator("[data-guided-target-outline]");
  await expect(targetOutline).toHaveCount(1);
  const calendarTargetBox = await calendarTarget.boundingBox();
  const targetOutlineBox = await targetOutline.boundingBox();
  if (!calendarTargetBox || !targetOutlineBox) {
    throw new Error("Destaque do calendário não pôde ser medido.");
  }
  expect(targetOutlineBox.x).toBeLessThan(calendarTargetBox.x);
  expect(targetOutlineBox.x + targetOutlineBox.width).toBeGreaterThan(
    calendarTargetBox.x + calendarTargetBox.width
  );

  await page.locator("[data-onboarding-calendar-control]").click();
  const choice = page.getByRole("dialog", { name: "Adicionar categoria" });
  const readyCalendarOption = choice.getByRole("button", {
    name: /Adicionar calendário pronto/,
  });
  const clickHint = readyCalendarOption.getByText("Clique aqui", { exact: true });
  const doze52Label = readyCalendarOption.getByText("Doze 52.", { exact: true });
  await expect(clickHint).toBeVisible();
  await expect(doze52Label.locator("..")).toHaveCSS("white-space", "nowrap");
  const hintBox = await clickHint.boundingBox();
  const doze52Box = await doze52Label.boundingBox();
  if (!hintBox || !doze52Box) throw new Error("Opção pronta não pôde ser medida.");
  expect(Math.abs(hintBox.y - doze52Box.y)).toBeLessThanOrEqual(4);
  expect(hintBox.x).toBeGreaterThan(doze52Box.x + doze52Box.width);
  await choice
    .getByRole("button", { name: /Adicionar calendário pronto/ })
    .click();
  const gallery = page.getByRole("dialog", {
    name: "Adicione os feriados do seu estado",
  });
  await gallery.getByRole("button", { name: "Adicionar feriados" }).click();

  await expect(
    page.locator('[data-guided-toolbar-notice][data-guided-toolbar-target="year"]')
  ).toBeVisible();
  await expect(edit).toHaveAttribute("aria-label", /^Editar/);
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
    window.sessionStorage.setItem(
      "doze52:habits-prototype:v1",
      JSON.stringify({
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
      })
    );
  });
  await page.goto("/?surface=annual");
  await page
    .locator('[data-product-navigation="desktop"] [data-product-destination="habits"]')
    .click();
  const showcaseNotice = page.locator(
    '[data-guided-toolbar-notice][data-guided-toolbar-target="habit-showcase"]'
  );
  await expect(showcaseNotice).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Meu hábito preservado", exact: true })
  ).toHaveCount(0);
  await showcaseNotice.getByRole("button", { name: "Criar meu hábito" }).click();

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
        window.sessionStorage.getItem("doze52:habits-prototype:v1") ?? "{}"
      );
      return stored.habits?.map((habit: { id: string }) => habit.id);
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
