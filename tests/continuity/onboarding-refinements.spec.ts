import { expect, test, type Page } from "@playwright/test";
import { getOnboardingContextSeedSnapshot } from "../../lib/store";

const seedPage = async (
  page: Page,
  step: string,
  categoryCount = 1,
) => {
  const seed = getOnboardingContextSeedSnapshot(2026, "personal");
  await page.addInitScript(
    ({ seed, step, categoryCount }) => {
      const categories = seed.categories.slice(0, categoryCount);
      localStorage.setItem(
        "doze52:onboarding:v2",
        JSON.stringify({
          version: 15,
          step,
          context: "personal",
          dateCategoryId: categories[0]?.id,
          startedAt: "2026-09-07T10:00:00.000Z",
        }),
      );
      localStorage.setItem(
        "yiv-store",
        JSON.stringify({
          state: {
            ...seed,
            categories,
            events: [],
            selectedProfileIds: seed.profiles.map((profile) => profile.id),
            viewMode: "year",
            focusedQuarter: null,
            focusedMonth: null,
          },
          version: 0,
        }),
      );
    },
    { seed, step, categoryCount },
  );
  if (process.env.CONTINUITY_ACCESS_URL) {
    await page.goto(process.env.CONTINUITY_ACCESS_URL);
  }
  await page.goto("/?surface=annual");
};

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`geometria do guia e da grade ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedPage(page, "context_selection");
    const measure = () =>
      page.evaluate(() => {
        const rect = (selector: string) => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          if (!box) throw new Error(`Elemento ausente: ${selector}`);
          return { x: box.x, y: box.y, width: box.width, height: box.height };
        };
        const viewport = document.querySelector<HTMLElement>("[data-year-grid-scroll-viewport]");
        return {
          panel: rect("[data-onboarding-panel]"),
          grid: rect("[data-year-grid-frame]"),
          scrollTop: viewport?.scrollTop ?? -1,
          januaryVisible: Boolean(document.querySelector('[data-month-label="0"]')),
        };
      });
    await expect(page.locator("[data-onboarding-panel]")).toBeVisible();
    await page.waitForTimeout(700);
    const annual = await measure();
    expect(annual.scrollTop).toBe(0);
    expect(annual.januaryVisible).toBe(true);
    await page.locator('[data-product-navigation="desktop"] [data-product-destination="habits"]').click();
    await expect(page.locator('[data-year-grid-surface="habits"]')).toBeVisible();
    await page.waitForTimeout(700);
    const habits = await measure();
    expect(habits.grid).toEqual(annual.grid);
    expect(habits.panel).toEqual(annual.panel);
  });
}

test("destaques usam somente fundo tonal nos temas claro e escuro", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await seedPage(page, "year_instruction");
  const assertTonal = async () => {
    const target = page.locator('[data-calendar-year-stepper]');
    await expect(target).toHaveAttribute("data-onboarding-highlighted", "true");
    const style = await target.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        backgroundImage: computed.backgroundImage,
        boxShadow: computed.boxShadow,
        outlineStyle: computed.outlineStyle,
      };
    });
    expect(style.backgroundImage).not.toBe("none");
    expect(style.boxShadow).toBe("none");
    expect(style.outlineStyle).toBe("none");
    const siblingOpacity = await page.locator('[data-app-header-navigation-row]').evaluate((element) => getComputedStyle(element).opacity);
    expect(siblingOpacity).toBe("1");
  };
  await assertTonal();
  await page.getByRole("button", { name: "Ativar tema escuro", exact: true }).click();
  await assertTonal();
});

test("troca de ano preserva a escolha e o botão central retorna para hoje", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await seedPage(page, "year_instruction");
  const currentYear = new Date().getFullYear();
  const center = page.getByRole("button", { name: new RegExp(`Ano ${currentYear}\\. Ir para hoje`) });
  await expect(center).toHaveCSS("cursor", "pointer");
  await page.getByRole("button", { name: `Voltar para ${currentYear - 1}` }).last().click();
  await expect(page.getByRole("button", { name: new RegExp(`Ano ${currentYear - 1}\\. Ir para hoje`) })).toBeVisible();
  await page.locator('[data-guided-toolbar-notice]').getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Ano ${currentYear - 1}\\. Ir para hoje`) })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`Ano ${currentYear - 1}\\. Ir para hoje`) }).press("Enter");
  await expect(page.getByRole("button", { name: new RegExp(`Ano ${currentYear}\\. Ir para hoje`) })).toBeVisible();
  await expect.poll(() => page.locator('[data-year-grid-scroll-viewport]').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("meses e trimestres recortam a visão sem criar período", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await seedPage(page, "period_navigation_instruction");
  await expect(page.locator('[data-guided-toolbar-notice]')).toContainText("Veja um recorte do seu ano.");
  const q1 = page.locator('[data-quarter-label="0"]');
  const january = page.locator('[data-month-label="0"]');
  await q1.click();
  await expect(q1).toHaveAttribute("aria-pressed", "true");
  await january.click();
  await expect(january).toHaveAttribute("aria-pressed", "true");
  await january.click();
  await expect(q1).toHaveAttribute("aria-pressed", "true");
  await q1.click();
  await expect(q1).toHaveAttribute("aria-pressed", "false");
  const february = page.locator('[data-month-label="1"]');
  const first = await january.boundingBox();
  const second = await february.boundingBox();
  if (!first || !second) throw new Error("Rótulos de mês não renderizados");
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2);
  await page.mouse.up();
  await expect(page.getByRole("textbox", { name: "Título do evento" })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("yiv-store") ?? "{}").state.events.length)).toBe(0);
});

test("etapa final exige três categorias, substitui a terceira e permite devolução", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await seedPage(page, "wrap_up_instruction", 1);
  await page.locator('[data-product-organize="desktop"]').click();
  const organizer = page.getByRole("dialog", { name: "Organizar" });
  const finish = organizer.getByRole("button", { name: "Finalizar guia" });
  await expect(finish).toBeDisabled();
  const suggestions = organizer.locator('button[aria-label^="Adicionar categoria "]');
  const firstName = await suggestions.first().getAttribute("aria-label");
  await suggestions.first().click();
  if (firstName) await expect(page.getByRole("button", { name: firstName })).toHaveCount(0);
  await expect(finish).toBeDisabled();
  const secondName = await suggestions.first().getAttribute("aria-label");
  await suggestions.first().click();
  await expect(finish).toBeEnabled();
  const categoryIdsBefore = await organizer.locator('[data-onboarding-category-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-onboarding-category-id')));
  await suggestions.first().click();
  const categoryIdsAfter = await organizer.locator('[data-onboarding-category-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-onboarding-category-id')));
  expect(categoryIdsAfter).toHaveLength(3);
  expect(categoryIdsAfter.slice(0, 2)).toEqual(categoryIdsBefore.slice(0, 2));
  if (secondName) await expect(organizer.getByRole("button", { name: secondName })).toBeVisible();
  const demote = organizer.getByRole("button", { name: /^Mover .+ para sugestões$/ }).last();
  await demote.press("Enter");
  await expect(finish).toBeDisabled();
  await page.reload();
  await page.locator('[data-product-organize="desktop"]').click();
  await expect(page.getByRole("button", { name: "Finalizar guia" })).toBeDisabled();
});
