import { expect, test, type Page } from "@playwright/test";

const waitForControllingServiceWorker = async (page: Page) => {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
};

const cachedUrls = (page: Page) =>
  page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(request.url);
    }
    return urls;
  });

test("/sw.js é revalidado sempre e registra no escopo raiz", { tag: "@desktop" }, async ({
  page,
  request,
}) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/javascript");
  expect(response.headers()["cache-control"]).toContain("no-cache");
  const source = await response.text();
  // O id do build tem que ter sido substituído.
  expect(source).not.toContain("__BUILD_ID__");

  await page.goto("/");
  await waitForControllingServiceWorker(page);
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.scope;
  });
  expect(scope).toBe(new URL("/", page.url()).href);
});

for (const tag of ["@desktop", "@mobile"] as const) {
  test(`${tag.slice(1)} abre o shell sem rede depois da primeira visita`, { tag }, async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await waitForControllingServiceWorker(page);

    await context.setOffline(true);
    await page.reload();

    // Hidratou mesmo sem rede: o shell e os chunks vieram do cache.
    await expect(page.locator("[data-brand-logo-position]")).toBeVisible();
    await context.setOffline(false);
  });
}

test("nada específico do usuário entra no cache e o shell não depende de cookie", { tag: "@desktop" }, async ({
  page,
  context,
  baseURL,
}) => {
  // Cookie com cara de sessão do Supabase: o shell tem que ser idêntico.
  const request = context.request;
  const anonymous = await (await request.get("/")).text();
  await context.addCookies([
    {
      name: "sb-test-auth-token",
      value: "base64-fake",
      url: baseURL!,
    },
  ]);
  const withSession = await (await request.get("/")).text();
  expect(withSession).toBe(anonymous);

  await page.goto("/");
  await waitForControllingServiceWorker(page);
  // Rotas que o SW nunca pode guardar.
  await page.evaluate(() => fetch("/api/billing/status").catch(() => undefined));
  await page.evaluate(() => fetch("/auth/reset-password").catch(() => undefined));

  const urls = await cachedUrls(page);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    const { origin, pathname } = new URL(url);
    expect(origin).toBe(new URL(page.url()).origin);
    expect(pathname === "/" || /^\/(_next\/static|icons)\//.test(pathname) || pathname === "/icon.svg" || pathname === "/manifest.webmanifest", url).toBe(true);
  }
});

for (const tag of ["@desktop", "@mobile"] as const) {
  test(`${tag.slice(1)} selo Atualizar ativa o service worker novo antes de recarregar`, { tag }, async ({
    page,
  }) => {
    await page.goto("/");
    await waitForControllingServiceWorker(page);
    const activeScript = () =>
      page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL);

    // Simula um deploy: o Playwright não intercepta a busca do script do SW,
    // então registramos o mesmo código sob outra URL no mesmo escopo (o
    // navegador instala como versão nova e a deixa esperando) e fazemos
    // /api/version responder com outro id de build.
    await page.evaluate(() =>
      navigator.serviceWorker.register("/sw.js?v=e2e-next", { scope: "/", updateViaCache: "none" })
    );
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      while (!registration?.waiting) await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await page.route("**/api/version", (route) =>
      route.fulfill({ json: { buildId: "e2e-next" } })
    );
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

    // Enquanto a pessoa não aceita, a versão antiga segue ativa.
    const badge = page.locator("[data-app-update-badge]");
    await expect(badge).toBeVisible();
    expect(await activeScript()).not.toContain("e2e-next");

    await Promise.all([page.waitForEvent("load"), badge.click()]);

    await waitForControllingServiceWorker(page);
    await expect.poll(activeScript).toContain("e2e-next");
    await expect(page.locator("[data-brand-logo-position]")).toBeVisible();
  });
}
