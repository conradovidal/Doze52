import { expect, test as setup } from "@playwright/test";

import {
  expectAuthenticated,
  installVercelBypass,
  waitForRemoteBootstrapAfterLogin,
} from "./support/browser";
import { getE2eCredentials } from "./support/qa-env";

const authStatePath = "playwright/.auth/e2e.json";

setup("autenticar a conta E2E no Supabase DEV", async ({ page }) => {
  await installVercelBypass(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Doze 52 | Seu ano em uma página");

  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Entrar" });
  const credentials = getE2eCredentials();
  await dialog.getByLabel("Email").fill(credentials.email);
  await dialog.getByLabel("Senha").fill(credentials.password);
  const remoteBootstrap = waitForRemoteBootstrapAfterLogin(page);
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(dialog).toBeHidden();
  await expectAuthenticated(page);
  await remoteBootstrap;
  await expect
    .poll(async () => page.context().cookies().then((cookies) => cookies.length))
    .toBeGreaterThan(0);
  await page.context().storageState({ path: authStatePath, indexedDB: true });
});
