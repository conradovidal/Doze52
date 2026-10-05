import { expect, test } from "@playwright/test";

test("mobile: viewport cobre a tela e o shell respeita as áreas seguras", { tag: "@mobile" }, async ({
  page,
}) => {
  await page.goto("/");

  // Sem viewport-fit=cover os env(safe-area-inset-*) valem sempre 0.
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).toContain("viewport-fit=cover");

  const body = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { overscroll: style.overscrollBehaviorY, touch: style.touchAction };
  });
  expect(body.overscroll).toBe("none");
  expect(body.touch).toBe("manipulation");

  // Sem notch os insets são 0 e o layout fica idêntico ao de antes: o piso
  // de 12px (cabeçalho) e 8px (barra inferior) continua valendo.
  const header = page.locator("[data-app-header-navigation-row]");
  await expect(header).toBeVisible();
  const headerPad = await header.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.paddingLeft, s.paddingRight];
  });
  expect(headerPad).toEqual(["12px", "12px"]);

  const navPad = await page.locator("nav.fixed.bottom-0").evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.paddingLeft, s.paddingRight];
  });
  expect(navPad).toEqual(["8px", "8px"]);
});

test("desktop: o shell não ganha padding lateral sem áreas seguras", { tag: "@desktop" }, async ({
  page,
}) => {
  await page.goto("/");
  const pad = await page.evaluate(() => {
    const root = document.querySelector("body > div.h-dvh");
    if (!root) throw new Error("Shell raiz não encontrado.");
    const s = getComputedStyle(root);
    return [s.paddingLeft, s.paddingRight];
  });
  expect(pad).toEqual(["0px", "0px"]);
});
