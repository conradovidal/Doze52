import { expect, test } from "@playwright/test";
import { openAuthenticatedSettings } from "./support/browser";

const submitFeedback = async (page: import("@playwright/test").Page, message: string) => {
  await page.goto("/");
  await openAuthenticatedSettings(page, "help");
  await page.getByRole("button", { name: "Enviar feedback" }).click();
  const dialog = page.getByRole("dialog", { name: "Enviar feedback" });
  await dialog.getByLabel("Tipo").click();
  await page.getByRole("option", { name: "Problema" }).click();
  await dialog.getByLabel("Mensagem").fill(message);
  await dialog.getByRole("button", { name: "Enviar feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback enviado" })).toContainText(/Protocolo [A-F0-9]{8}/);
};

test("envia feedback autenticado sem consentimento", async ({ page }) => {
  await submitFeedback(page, "Teste automatizado do formulário em desktop.");
});

test("envia feedback no viewport mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await submitFeedback(page, "Teste automatizado do formulário em viewport mobile.");
});

test("usuário comum não acessa o painel administrativo", async ({ page }) => {
  await page.goto("/admin/feedback");
  await expect(page).toHaveTitle(/404/);
});
