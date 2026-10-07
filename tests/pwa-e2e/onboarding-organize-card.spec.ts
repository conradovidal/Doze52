import { expect, test } from "@playwright/test";

test("passo 6 do onboarding mobile: o card cola no lápis e o cita", { tag: "@mobile" }, async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("doze52:mobile-habits-onboarding:v1", "annual_organize");
    window.localStorage.setItem("doze52:last-surface:v1", "annual");
  });
  await page.goto("/?surface=annual");

  const card = page.locator('[data-guided-toolbar-target="mobile-organize"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("Toque no lápis");
  await expect(card.locator("[data-guided-notice-pointer]")).toBeVisible();

  const pencil = page.getByRole("button", { name: "Editar", exact: true }).first();
  const pencilBox = (await pencil.boundingBox())!;
  const cardBox = (await card.boundingBox())!;
  // Logo abaixo do lápis (só a setinha no meio) e alinhado à direita com ele.
  expect(cardBox.y - (pencilBox.y + pencilBox.height)).toBeLessThan(16);
  expect(cardBox.y).toBeGreaterThan(pencilBox.y + pencilBox.height - 4);
  const viewport = page.viewportSize()!;
  expect(viewport.width - (cardBox.x + cardBox.width)).toBeLessThan(16);
});
