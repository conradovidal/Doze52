import { readFileSync } from "node:fs";
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

test("o link de confirmação volta para a própria origem, numa página que não carrega o app", { tag: "@mobile" }, async ({ page }) => {
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
  // A janela do e-mail cai numa página simples, que não carrega o app.
  expect(redirectTo).toBe(`${origin}/auth/callback?next=%2Fauth%2Fconfirmed`);
});

// Sessão de fixture, só para o cliente reconhecer "há sessão" (o servidor não a
// valida aqui): simula o cookie que o link do e-mail deixa no navegador.
// O nome do cookie leva o projeto do Supabase com que o app foi construído.
const supabaseRef = () => {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    try {
      url = /^NEXT_PUBLIC_SUPABASE_URL="?([^"\n]+)"?$/m.exec(readFileSync(".env.local", "utf8"))?.[1];
    } catch {
      // sem .env.local: cai no erro abaixo
    }
  }
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL não encontrada (env ou .env.local).");
  return new URL(url).hostname.split(".")[0];
};

const sessionCookieFor = async (page: Page) => {
  const ref = supabaseRef();
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const user = {
    id: "00000000-0000-4000-8000-0000000000ee",
    aud: "authenticated",
    role: "authenticated",
    email: "nova.pessoa@exemplo.com",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", exp })}.sig`;
  const session = { access_token: jwt, refresh_token: "fixture", token_type: "bearer", expires_in: 86400, expires_at: exp, user };
  return {
    name: `sb-${ref}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
    url: new URL(page.url()).origin,
  };
};

test("a página do link do e-mail avisa o resultado sem carregar o app", { tag: "@mobile" }, async ({
  page,
  context,
}) => {
  await page.goto("/auth/confirmed");
  await expect(page.locator("[data-confirmation-result]")).toHaveAttribute("data-confirmation-result", "failed");
  await expect(page.getByText("Reenviar e-mail")).toBeVisible();
  // Não é o app: nada de calendário nem de navegação.
  await expect(page.locator('[data-product-navigation="mobile"]')).toHaveCount(0);

  await context.addCookies([await sessionCookieFor(page)]);
  await page.reload();
  await expect(page.locator("[data-confirmation-result]")).toHaveAttribute("data-confirmation-result", "ok");
  await expect(page.getByRole("button", { name: "Ok", exact: true })).toBeVisible();
  await expect(page.locator('[data-product-navigation="mobile"]')).toHaveCount(0);
});

test("a aba onde a pessoa se cadastrou percebe a confirmação sozinha", { tag: "@mobile" }, async ({
  page,
  context,
}) => {
  const email = "nova.pessoa@exemplo.com";
  await mockSignupRequiringConfirmation(page, email);
  await page.goto("/");
  await openSignup(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha-segura-123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.locator("[data-email-confirmation]")).toBeVisible();

  // O link do e-mail, aberto noutra janela, deixa a sessão no navegador.
  await context.addCookies([await sessionCookieFor(page)]);
  await expect(page.locator("[data-email-confirmation]")).toHaveCount(0, { timeout: 10_000 });
});
