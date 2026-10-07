import { expect, test, type Page } from "@playwright/test";

// O Supabase é simulado: responde ao cadastro como o projeto com "Confirm
// email" ligado, devolvendo o usuário sem sessão.
const mockSignupRequiringConfirmation = (page: Page, email: string) =>
  page.route("**/auth/v1/signup*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        id: "00000000-0000-4000-8000-0000000000aa",
        aud: "authenticated",
        role: "",
        email,
        confirmation_sent_at: new Date().toISOString(),
        app_metadata: { provider: "email" },
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
      },
    })
  );

const openSignup = async (page: Page) => {
  await page.getByRole("button", { name: "Abrir perfil" }).first().click();
  await page.getByRole("button", { name: "Cadastro", exact: true }).click();
};

test("cadastro sem sessão mostra o cartão de confirmação, que sobrevive a fechar o painel", { tag: "@mobile" }, async ({
  page,
}) => {
  const email = "nova.pessoa@exemplo.com";
  await mockSignupRequiringConfirmation(page, email);
  await page.goto("/");
  await openSignup(page);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha-segura-123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();

  const card = page.locator("[data-email-confirmation]");
  await expect(card).toBeVisible();
  await expect(card).toContainText(email);
  await expect(card).toContainText("60 minutos");
  // Recém-enviado: o reenvio espera o intervalo.
  await expect(card.getByRole("button", { name: /^Reenviar e-mail \(\d+s\)$/ })).toBeDisabled();

  // Fechar e reabrir o painel: o cartão continua lá.
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Abrir perfil" }).first().click();
  await expect(page.locator("[data-email-confirmation]")).toContainText(email);

  // "Usar outro e-mail" volta ao formulário e esquece a pendência.
  await page.getByRole("button", { name: "Usar outro e-mail" }).click();
  await expect(page.locator("[data-email-confirmation]")).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveValue("");
  await page.reload();
  await page.getByRole("button", { name: "Abrir perfil" }).first().click();
  await expect(page.locator("[data-email-confirmation]")).toHaveCount(0);
});

test("o link de confirmação volta para a própria origem", { tag: "@mobile" }, async ({ page }) => {
  let redirectTo: string | null = null;
  await page.route("**/auth/v1/signup*", async (route) => {
    redirectTo = new URL(route.request().url()).searchParams.get("redirect_to");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: { id: "00000000-0000-4000-8000-0000000000ab", aud: "authenticated", role: "", email: "a@b.co", app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString() },
    });
  });
  await page.goto("/");
  await openSignup(page);
  await page.getByLabel("Email").fill("a@b.co");
  await page.getByLabel("Senha").fill("senha-segura-123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.locator("[data-email-confirmation]")).toBeVisible();

  const origin = new URL(page.url()).origin;
  expect(redirectTo).toBe(`${origin}/auth/callback`);
});
