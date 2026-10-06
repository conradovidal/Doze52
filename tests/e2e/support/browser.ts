import { expect, type Page } from "@playwright/test";

import { getQaBaseUrl } from "./qa-env";

export const installVercelBypass = async (page: Page) => {
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!bypassSecret) return;

  const allowedOrigin = getQaBaseUrl();
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== allowedOrigin) {
      await route.continue();
      return;
    }
    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-vercel-protection-bypass": bypassSecret,
        "x-vercel-set-bypass-cookie": "true",
      },
    });
  });
};

const isInitialEventsRead = (response: import("@playwright/test").Response) =>
  response.request().method() === "GET" &&
  response.url().includes("/rest/v1/events") &&
  response.status() < 400;

export const openQaApp = async (page: Page) => {
  const eventsLoaded = page.waitForResponse(isInitialEventsRead);
  await page.goto("/");
  await eventsLoaded;
  await page.waitForLoadState("networkidle");
  await waitForSyncReady(page);
};

// O aviso "Sincronizado" dura 1s: curto demais para esperar por ele. O que
// importa é que nada esteja sincronizando e que não haja erro.
export const waitForSyncReady = async (page: Page) => {
  await expect(page.getByText("Sincronizando...", { exact: true })).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.getByText("Erro ao sincronizar", { exact: true })).toHaveCount(0);
};

export const waitForRemoteBootstrapAfterLogin = async (page: Page) => {
  const response = await page.waitForResponse(isInitialEventsRead);
  expect(response.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await waitForSyncReady(page);
};

export const dismissOnboardingIfVisible = async (page: Page) => {
  const guidedButton = page.getByRole("button", {
    name: "Encerrar guia inicial",
  });
  if (await guidedButton.isVisible().catch(() => false)) {
    await guidedButton.click();
    const confirmation = page.getByRole("dialog", {
      name: /Encerrar o guia\?/,
    });
    if (await confirmation.isVisible().catch(() => false)) {
      await confirmation
        .getByRole("button", { name: "Encerrar e explorar" })
        .click();
    }
    return;
  }
  const legacyButton = page.getByRole("button", { name: "Entendi" });
  if (await legacyButton.isVisible().catch(() => false)) {
    await legacyButton.click();
  }
};

export const expectAuthenticated = async (page: Page) => {
  await expect(page.getByRole("button", { name: /Abrir (perfil|conta)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toHaveCount(0);
};

/**
 * Abre o painel de conta e entra no tópico. No desktop o tópico é um botão
 * da barra lateral ("Dados"); no mobile é uma linha da lista da raiz
 * ("Dados Importação e exportação"), que desliza para a tela do tópico.
 * Devolve o painel.
 */
export const openAuthenticatedSettings = async (
  page: Page,
  topic: "data" | "help" = "data"
) => {
  await page.getByRole("button", { name: /Abrir (perfil|conta)/ }).click();
  const panel = page.locator("[data-app-utility-panel]");
  await expect(panel).toBeVisible();
  const topicLabel = topic === "data" ? "Dados" : "Ajuda";
  await panel.getByRole("button", { name: new RegExp(`^${topicLabel}\\b`) }).first().click();
  return panel;
};

export const waitForSupabaseWrite = (
  page: Page,
  table: "calendar_profiles" | "categories" | "events",
  methods: Array<"POST" | "PATCH" | "DELETE"> = ["POST", "PATCH", "DELETE"]
) =>
  page.waitForResponse(
    (response) => {
      const isAtomicSnapshot =
        response.url().includes("/rest/v1/rpc/replace_calendar_snapshot") &&
        response.request().method() === "POST";
      const isLegacyTableWrite =
        response.url().includes(`/rest/v1/${table}`) &&
        methods.includes(
          response.request().method() as "POST" | "PATCH" | "DELETE"
        );
      return (
        (isAtomicSnapshot || isLegacyTableWrite) && response.status() < 400
      );
    },
    { timeout: 15_000 }
  );

export const observeRuntimeIssues = (page: Page) => {
  const issues: string[] = [];
  const essentialResponses: Array<{ status: number; url: string }> = [];

  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") issues.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? "";
    if (
      url.startsWith("data:") ||
      url.includes("vercel-insights") ||
      url.includes("/.well-known/vercel/") ||
      failure.includes("ERR_ABORTED")
    ) {
      return;
    }
    issues.push(`requestfailed: ${new URL(url).pathname}`);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (
      url.includes("/rest/v1/calendar_profiles") ||
      url.includes("/rest/v1/categories") ||
      url.includes("/rest/v1/events") ||
      url.includes("/api/billing/status")
    ) {
      essentialResponses.push({ status: response.status(), url });
    }
    if (response.status() >= 500 && !url.includes("vercel-insights")) {
      issues.push(`response ${response.status()}: ${new URL(url).pathname}`);
    }
  });

  return {
    assertClean() {
      expect(issues, issues.join("\n")).toEqual([]);
      expect(essentialResponses.length).toBeGreaterThan(0);
      expect(
        essentialResponses.filter((response) => response.status >= 400),
        "Requisicoes essenciais devem responder sem erros."
      ).toEqual([]);
    },
  };
};

/** Abre o painel "Editar" (contextos e categorias) e devolve o diálogo. */
export const openEditWorkspace = async (page: Page) => {
  await page.getByRole("button", { name: "Editar", exact: true }).first().click();
  const workspace = page.getByRole("dialog", { name: "Editar" });
  await expect(workspace).toBeVisible();
  return workspace;
};

export const closeEditWorkspace = async (page: Page) => {
  const workspace = page.getByRole("dialog", { name: "Editar" });
  await workspace.getByRole("button", { name: "Close" }).click();
  await expect(workspace).toBeHidden();
};

/** Cria uma categoria própria pelo painel Editar e espera ela ir para o Supabase. */
export const createCustomCategory = async (page: Page, name: string) => {
  const workspace = await openEditWorkspace(page);
  await workspace.getByRole("button", { name: "Criar nova categoria" }).click();
  await page.getByRole("button", { name: /^Criar minha categoria/ }).click();
  const categoryDialog = page.getByRole("dialog", { name: "Nova categoria" });
  await categoryDialog.getByLabel("Nome da categoria").fill(name);
  const categorySaved = waitForSupabaseWrite(page, "categories", ["POST"]);
  await categoryDialog.getByRole("button", { name: "Criar", exact: true }).click();
  // Criada a categoria, o fluxo volta para o painel Editar.
  await expect(workspace).toBeVisible();
  await expect(categoryDialog).toBeHidden();
  await closeEditWorkspace(page);
  await categorySaved;
  await waitForSyncReady(page);
};

/** Abre o catálogo de calendários prontos (Editar → Criar nova categoria → Adicionar calendário pronto). */
export const openReadyCalendars = async (page: Page) => {
  const workspace = await openEditWorkspace(page);
  await workspace.getByRole("button", { name: "Criar nova categoria" }).click();
  await page.getByRole("button", { name: /^Adicionar calendário pronto/ }).click();
  const calendars = page.getByRole("dialog", { name: "Calendários" });
  await expect(calendars).toBeVisible();
  return calendars;
};

/** Depois de recarregar, a barra de contextos e categorias pode voltar recolhida. */
export const showCategories = async (page: Page) => {
  const toggle = page.getByRole("button", { name: "Mostrar contextos e categorias" });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
};
