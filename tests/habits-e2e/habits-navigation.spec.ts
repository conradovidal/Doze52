import { expect, test } from "@playwright/test";

const installCompletedOnboarding = async (
  page: import("@playwright/test").Page
) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({
        version: 11,
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
  const logo = page.locator('[data-brand-logo-position="header-center"]');
  const logoBox = await logo.boundingBox();
  const viewport = page.viewportSize();
  if (!logoBox || !viewport) throw new Error("Logo não pôde ser medido.");
  expect(Math.abs(logoBox.x + logoBox.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
};

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
  });
  await page.goto("/");
  const rail = page.locator('[data-product-navigation="desktop"]');
  await expect(rail).toBeVisible();
  expect((await rail.boundingBox())?.width).toBe(52);
  await expect(rail.getByRole("link", { name: "Anual" })).toHaveClass(/text-foreground/);
  await expect(rail.getByRole("link", { name: "Anual" })).not.toHaveClass(/bg-foreground/);
  await expectCenteredLogo(page);
  const profileBox = await rail.getByRole("button", { name: "Abrir perfil" }).boundingBox();
  const annualBox = await rail.getByRole("link", { name: "Anual" }).boundingBox();
  const habitsBox = await rail.getByRole("link", { name: "Hábitos" }).boundingBox();
  if (!profileBox || !annualBox || !habitsBox) {
    throw new Error("Itens da rail não puderam ser medidos.");
  }
  expect(profileBox.y).toBeLessThan(annualBox.y);
  expect(annualBox.y).toBeLessThan(habitsBox.y);
  await expect(page.locator('[data-calendar-ui-mode="desktop"]')).toBeVisible();

  const calendarRegion = page.locator("[data-desktop-calendar-scroll-region]");
  const widthBefore = (await calendarRegion.boundingBox())?.width;
  await expect(page.getByRole("button", { name: "Abrir configurações" })).toHaveCount(0);
  const profile = page.getByRole("button", { name: "Abrir perfil" });
  await profile.click();
  const panel = page.locator("[data-app-utility-panel]");
  await expect(panel).toBeVisible();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport desktop indisponível.");
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(
    Math.min(880, viewport.width - 80)
  );
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
  const habits = page.locator("[data-habits-prototype]");
  await expect(habits).toHaveAttribute("data-habits-layout", "desktop-year");
  await expect(habits.locator('[data-year-grid-surface="habits"]')).toBeVisible();
  const completedDay = habits.locator('[data-day-cell][data-day-iso$="-01-01"]');
  await expect(completedDay.locator("[data-habit-marker]")).toHaveCount(4);
  await expect(completedDay.locator('[data-habit-slot="top-left"]')).toBeVisible();
  await expect(completedDay.locator('[data-habit-slot="top-right"]')).toBeVisible();
  await expect(completedDay.locator('[data-habit-slot="bottom-left"]')).toBeVisible();
  await expect(completedDay.locator('[data-habit-slot="bottom-right"]')).toBeVisible();
  await completedDay.click();
  await expect(completedDay.locator("[data-habit-marker]")).toHaveCount(3);
  await completedDay.click();
  await expect(completedDay.locator("[data-habit-marker]")).toHaveCount(4);
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
  await page.getByLabel("Nome do hábito").fill("Ler");
  await page.getByRole("button", { name: "Criar hábito" }).click();
  await expect(habits.getByRole("button", { name: "Ler", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(emptyDay.locator("[data-habit-marker]")).toHaveCount(0);
  await expect(habits.locator('[data-day-cell][aria-disabled="true"]').first()).toBeVisible();
});

test("onboarding de tema usa o painel de Configurações", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Cenário desktop");

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "doze52:onboarding:v2",
      JSON.stringify({
        version: 11,
        step: "theme_instruction",
        context: "personal",
        startedAt: new Date().toISOString(),
        dateItemsCreated: 2,
        periodItemsCreated: 2,
      })
    );
  });
  await page.goto("/?surface=annual");

  const panel = page.locator("[data-app-utility-panel]");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: /^Aparência/ })).toHaveAttribute(
    "aria-current",
    "page"
  );
  const notice = page.locator(
    '[data-guided-toolbar-notice][data-guided-toolbar-target="theme"]'
  );
  await expect(notice).toBeVisible();
  await expect(page.locator("[data-onboarding-theme-control]")).toHaveAttribute(
    "data-onboarding-highlighted",
    "true"
  );
  await page.locator("[data-onboarding-theme-control]").click();
  await notice.getByRole("button", { name: "Explorar meu ano" }).click();
  await expect(panel).toBeHidden();
  await expect(notice).toBeHidden();
});
