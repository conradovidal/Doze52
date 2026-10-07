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

  test("sem conta não há convite nem linha Instalar app, mesmo com o prompt do navegador", { tag: "@mobile" }, async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await dispatchInstallPrompt(page);

    // O convite espera ~4s depois de estar pronto: dá tempo de ele aparecer, se fosse aparecer.
    await page.waitForTimeout(5000);
    await expect(page.getByRole("status").filter({ hasText: "Instale o Doze 52" })).toHaveCount(0);

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
