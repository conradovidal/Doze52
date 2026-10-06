import { expect, test } from "@playwright/test";

// Posição da região dos avisos (toasts): é fixa e vazia até haver um aviso, então
// dá para medir sem precisar provocar um.

test("mobile: os avisos ficam acima da barra de navegação, sobre o calendário", { tag: "@mobile" }, async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.locator('[data-product-navigation="mobile"]');
  await expect(nav).toBeVisible();

  const region = page.locator("[data-feedback-region]");
  const navTop = (await nav.boundingBox())!.y;
  const regionBottom = await region.evaluate((el) => el.getBoundingClientRect().bottom);
  // Acima da barra, com folga de ~12px (0.75rem).
  expect(regionBottom).toBeLessThanOrEqual(navTop - 8);
  expect(regionBottom).toBeGreaterThan(navTop - 40);
});

test("desktop: sem barra inferior, os avisos ficam rente ao rodapé", { tag: "@desktop" }, async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('[data-product-navigation="mobile"]')).toBeHidden();

  const region = page.locator("[data-feedback-region]");
  const gap = await region.evaluate(
    (el) => window.innerHeight - el.getBoundingClientRect().bottom
  );
  expect(gap).toBe(16);
});
