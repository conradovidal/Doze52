import { expect, test, type Page } from "@playwright/test";

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

// Simula o que o Chrome entrega quando o app é instalável.
const dispatchInstallPrompt = (page: Page) =>
  page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = async () => {
      (window as unknown as { __installPrompted?: boolean }).__installPrompted = true;
    };
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(event);
  });

const openProfile = async (page: Page) => {
  await page.getByRole("button", { name: "Abrir perfil" }).first().click();
  // A folha do perfil sem conta lista os tópicos; "Plano" prova que abriu.
  await expect(page.getByRole("button", { name: /^Plano/ })).toBeVisible();
};

test.describe("Android/Chrome", () => {
  test.use({ userAgent: ANDROID_CHROME });

  test("o prompt do navegador vira a linha Instalar app no perfil", { tag: "@mobile" }, async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await dispatchInstallPrompt(page);

    await openProfile(page);
    const row = page.getByRole("button", { name: /^Instalar app/ });
    await expect(row).toBeVisible();
    await row.click();

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __installPrompted?: boolean }).__installPrompted === true
        )
      )
      .toBe(true);
    // O prompt só vale uma vez: a linha some depois de usado.
    await page.getByRole("button", { name: "Abrir perfil" }).first().click();
    await expect(page.getByRole("button", { name: /^Plano/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Instalar app/ })).toHaveCount(0);
  });

  test("no app já instalado (display-mode standalone) não há o que instalar", { tag: "@mobile" }, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query.includes("display-mode: standalone")
          ? ({
              matches: true,
              media: query,
              onchange: null,
              addEventListener: () => undefined,
              removeEventListener: () => undefined,
              addListener: () => undefined,
              removeListener: () => undefined,
              dispatchEvent: () => false,
            } as MediaQueryList)
          : original(query);
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await dispatchInstallPrompt(page);

    await openProfile(page);
    await expect(page.getByRole("button", { name: /^Instalar app/ })).toHaveCount(0);
  });
});

test("iOS sem conta não recebe o convite (o app instalado perderia os dados locais)", { tag: "@mobile" }, async ({
  page,
}) => {
  // O projeto mobile usa o user agent de iPhone.
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => navigator.userAgent)).toContain("iPhone");

  await openProfile(page);
  await expect(page.getByRole("button", { name: /^Instalar app/ })).toHaveCount(0);
});
