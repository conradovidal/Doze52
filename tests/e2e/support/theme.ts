import type { Page } from "@playwright/test";

// O tema saiu do cabeçalho e vive no menu do perfil (linha "Tema"): abre o
// perfil, alterna se preciso e fecha.
export const setThemeMode = async (page: Page, mode: "light" | "dark") => {
  const isDark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark")
  );
  if ((mode === "dark") === isDark) return;
  await page.locator('button[aria-label="Abrir perfil"]:visible').first().click();
  await page.getByRole("button", { name: /^Tema/ }).click();
  await page.keyboard.press("Escape");
};
