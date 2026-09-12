import { test, expect } from "@playwright/test";
import { getOnboardingContextSeedSnapshot } from "../../lib/store";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1700, height: 960 },
]) {
  test(`headers share geometry without a continuity bar ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const seed = getOnboardingContextSeedSnapshot(2026, "personal");
    await page.addInitScript((seed) => {
      if (localStorage.getItem("qa-header-seeded")) return;
      localStorage.setItem("qa-header-seeded", "1");
      localStorage.setItem(
        "doze52:onboarding:v2",
        JSON.stringify({ version: 15, step: "completed" }),
      );
      localStorage.setItem(
        "yiv-store",
        JSON.stringify({
          state: {
            ...seed,
            selectedProfileIds: seed.profiles.map((p) => p.id),
          },
          version: 0,
        }),
      );
    }, seed);
    if (process.env.CONTINUITY_ACCESS_URL)
      await page.goto(process.env.CONTINUITY_ACCESS_URL);
    await page.goto("/");
    await expect(
      page.locator("[data-app-header-navigation-row]"),
    ).toBeVisible();
    await expect(
      page.getByText("Seu progresso está neste navegador.", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Anual concluído. Se quiser continuar:", { exact: true }),
    ).toHaveCount(0);
    const toggle = page.locator('[data-product-header-minimize="desktop"]');
    if ((await toggle.getAttribute("aria-label"))?.includes("Mostrar"))
      await toggle.click();
    // Wait for control transitions to settle before comparing geometry.
    const measure = () =>
      page.evaluate(() => {
        const box = (s: string) => {
          const e = document.querySelector(s)!;
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, h: r.height, w: r.width };
        };
        return {
          nav: box("[data-app-header-navigation-row]"),
          grid: box("[data-year-grid-frame]"),
          control: box(
            document.querySelector('[data-habits-layout="desktop-year"]')
              ? '[data-habit-controls] button[aria-label="Criar novo hábito"]'
              : "[data-onboarding-profile-id]",
          ),
        };
      });
    await page.waitForTimeout(350);
    const annual = await measure();
    await page.screenshot({ path: test.info().outputPath("annual.png") });
    await page
      .locator(
        '[data-product-navigation="desktop"] [data-product-destination="habits"]',
      )
      .click();
    await page.waitForTimeout(350);
    const habits = await measure();
    await page.screenshot({ path: test.info().outputPath("habits.png") });
    expect(habits.nav).toEqual(annual.nav);
    expect({ x: habits.grid.x, y: habits.grid.y, w: habits.grid.w, h: habits.grid.h }).toEqual({
      x: annual.grid.x,
      y: annual.grid.y,
      w: annual.grid.w,
      h: annual.grid.h,
    });
    expect(habits.control.y).toBe(annual.control.y);
    expect(habits.control.h).toBe(annual.control.h);
    // Theme identity must match the approved neutral tokens in both surfaces.
    for (const mode of ["dark", "light"] as const) {
      await page
        .getByRole("button", {
          name: mode === "dark" ? "Ativar tema escuro" : "Ativar tema claro",
          exact: true,
        })
        .click();
      const colors = () =>
        page.evaluate(() => {
          const s = getComputedStyle(document.documentElement);
          return {
            background: s.getPropertyValue("--background").trim().toLowerCase(),
            card: s.getPropertyValue("--card").trim().toLowerCase(),
            foreground: s.getPropertyValue("--foreground").trim().toLowerCase(),
          };
        });
      const expected =
        mode === "dark"
          ? { background: "#171717", card: "#262626", foreground: "#fafafa" }
          : { background: "#ffffff", card: "#ffffff", foreground: "#404040" };
      const normalized = (c: Record<string, string>) =>
        Object.fromEntries(
          Object.entries(c).map(([k, v]) => [
            k,
            /^#[a-f0-9]{3}$/.test(v)
              ? "#" + [...v.slice(1)].map((x) => x + x).join("")
              : v,
          ]),
        );
      expect(normalized(await colors())).toEqual(expected);
      await page
        .locator(
          '[data-product-navigation="desktop"] [data-product-destination="annual"]',
        )
        .click();
      expect(normalized(await colors())).toEqual(expected);
      if (mode === "dark")
        await page.screenshot({
          path: test.info().outputPath("annual-dark.png"),
        });
      await page
        .locator(
          '[data-product-navigation="desktop"] [data-product-destination="habits"]',
        )
        .click();
      if (mode === "dark")
        await page.screenshot({
          path: test.info().outputPath("habits-dark.png"),
        });
    }
    await toggle.click();
    await page.waitForTimeout(350);
    const collapsedHabits = await page
      .locator("[data-year-grid-frame]")
      .boundingBox();
    await page
      .locator(
        '[data-product-navigation="desktop"] [data-product-destination="annual"]',
      )
      .click();
    await page.waitForTimeout(350);
    expect(
      (await page.locator("[data-year-grid-frame]").boundingBox())?.y,
    ).toEqual(collapsedHabits?.y);
    await page
      .getByRole("button", { name: "Abrir perfil", exact: true })
      .click();
    await page.getByRole("button", { name: "Ajuda", exact: true }).click();
    await page
      .getByRole("button", { name: "Introdução ao Anual", exact: true })
      .click();
    await expect(page.getByRole("dialog", { name: "Seu Anual" })).toBeVisible();
    await page.getByRole("button", { name: "Agora não", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Seu Anual" })).toHaveCount(
      0,
    );
  });
}
