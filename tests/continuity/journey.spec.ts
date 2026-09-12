import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

async function openHome(page: Page) {
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    if (
      new URL(route.request().url()).hostname !==
      "jbdukjmbtffcgklsxjml.supabase.co"
    ) {
      await route.abort();
      throw new Error(
        "A suíte foi impedida de acessar um Supabase fora de DEV.",
      );
    }
    await route.continue();
  });
  if (process.env.CONTINUITY_ACCESS_URL)
    await page.goto(process.env.CONTINUITY_ACCESS_URL);
  await page.goto("/");
}
async function createHabit(page: Page) {
  await page
    .locator("[data-habits-prototype]")
    .getByRole("button", { name: "Criar novo hábito" })
    .click();
  await page.getByLabel("Nome do hábito").fill("Hábito QA continuidade");
  await page.getByRole("button", { name: "Criar hábito", exact: true }).click();
  await page
    .locator(
      '[data-habits-prototype] button[aria-label^="Marcar Hábito QA continuidade"]',
    )
    .last()
    .click();
}
async function finishAnnual(page: Page) {
  const panel = page.getByRole("region", { name: "Guia inicial do Doze 52" });
  await panel.getByRole("button", { name: /Pessoal Para/ }).click();
  await panel
    .getByRole("button", { name: "Aniversários", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Criar categoria", exact: true })
    .click();
  for (const date of ["2026-09-12", "2026-09-13"]) {
    await page.locator(`[data-day-iso="${date}"]`).click();
    await page
      .getByRole("textbox", { name: "Título do evento" })
      .fill("Data QA");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Título do evento" }),
    ).toHaveCount(0);
  }
  await expect(page.locator("[data-guided-toolbar-notice]")).toContainText(
    "Esconda",
  );
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.locator("[data-onboarding-category-id]").first().click();
  await page
    .locator("[data-guided-toolbar-notice]")
    .getByRole("button", { name: "Continuar" })
    .click();
  await page.locator('[data-product-organize="desktop"]').click();
  await page
    .getByRole("button", { name: "Criar nova categoria", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Adicionar calendário pronto/ })
    .click();
  await page
    .getByRole("button", { name: "Adicionar feriados", exact: true })
    .click();
  await page
    .locator("[data-guided-toolbar-notice]")
    .getByRole("button", { name: "Continuar" })
    .click();
  await page
    .locator("[data-guided-toolbar-notice]")
    .getByRole("button", { name: "Continuar" })
    .click();
  await expect(page.locator("[data-guided-toolbar-notice]")).toContainText(
    "Veja o que você",
  );
  await page.locator('[data-product-organize="desktop"]').click();
  await page.getByRole("button", { name: /Adicionar categoria/ }).first().click();
  await page.getByRole("button", { name: "Finalizar guia" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("doze52:onboarding:v2") ?? "{}").step,
      ),
    )
    .toBe("completed");
}
for (const width of [320, 393, 430])
  test(`mobile ${width}: save invitation follows first check-in`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 852 });
    await openHome(page);
    await createHabit(page);
    const invite = page.getByRole("region", { name: "Guardar progresso" });
    await expect(invite).toBeVisible();
    await expect(page.locator("[data-guided-toolbar-notice]")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await invite.getByRole("button", { name: "Criar conta e salvar" }).click();
    await expect(
      page.getByRole("button", { name: "Cadastro", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload();
    await expect(invite).toBeVisible();
    await invite.getByRole("button", { name: "Continuar sem conta" }).click();
    await expect(invite).toHaveCount(0);
  });
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
])
  test(`desktop ${viewport.width}: guide targets remain visible`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openHome(page);
    const panel = page.getByRole("region", { name: "Guia inicial do Doze 52" });
    await expect(panel).toBeVisible();
    await page
      .locator('[data-onboarding-profile-id][title="Profissional"]')
      .click();
    await expect(
      page.locator('[data-onboarding-profile-id][title="Profissional"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await finishAnnual(page);
  });
test("account carries habits to an independent desktop browser and isolates sign-out", async ({
  browser,
}) => {
  test.skip(
    !existsSync(".vercel/continuity-qa.json"),
    "Requer a conta descartável de QA do Supabase DEV.",
  );
  test.setTimeout(120000);
  const { email, password } = JSON.parse(
    readFileSync(".vercel/continuity-qa.json", "utf8"),
  );
  const mobile = await browser.newContext({
    viewport: { width: 393, height: 852 },
  });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const a = await mobile.newPage();
    await openHome(a);
    await createHabit(a);
    const createdHabitId = await a.evaluate(
      () =>
        JSON.parse(localStorage.getItem("doze52:habits-view:v2") ?? "{}").state
          .habits[0].id,
    );
    await a.getByRole("button", { name: "Criar conta e salvar" }).click();
    await a.getByRole("button", { name: "Login", exact: true }).click();
    await a.getByLabel("Email", { exact: true }).fill(email);
    await a.getByLabel("Senha", { exact: true }).fill(password);
    await a.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(a.locator("[data-doze52-app-shell]")).toHaveAttribute(
      "data-account-sync-status",
      "saved",
    );
    const b = await desktop.newPage();
    await openHome(b);
    await b.getByRole("button", { name: "Entrar na sua conta" }).click();
    await b.getByLabel("Email", { exact: true }).fill(email);
    await b.getByLabel("Senha", { exact: true }).fill(password);
    await b.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      b.getByRole("button", { name: "Montar meu ano", exact: true }),
    ).toBeVisible();
    await expect(
      b.getByRole("region", { name: "Guia inicial do Doze 52" }),
    ).toHaveCount(0);
    await b.getByRole("button", { name: "Agora não", exact: true }).click();
    await b
      .locator(
        '[data-product-navigation="desktop"] [data-product-destination="habits"]',
      )
      .click();
    await expect(
      b.getByRole("button", { name: "Hábito QA continuidade", exact: true }),
    ).toBeVisible();
    expect(
      await b.evaluate(
        () =>
          JSON.parse(localStorage.getItem("doze52:habits-view:v2") ?? "{}")
            .state.habits[0].id,
      ),
    ).toBe(createdHabitId);
    expect(
      await b.evaluate(
        () =>
          Object.values(
            JSON.parse(localStorage.getItem("doze52:habits-view:v2") ?? "{}")
              .state.checkIns,
          ).length,
      ),
    ).toBe(1);
    await expect(
      b.getByRole("button", { name: "Montar meu ano", exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        b.evaluate(() => {
          const entry = Object.entries(localStorage).find(
            ([k]) =>
              k.startsWith("doze52:continuity:v1:") && !k.includes("anonymous"),
          );
          return entry
            ? JSON.parse(entry[1]).records.find(
                (r: { kind: string }) => r.kind === "onboarding",
              )?.payload.status
            : null;
        }),
      )
      .toBe("dismissed");
    await b.reload();
    await expect(b.locator("[data-doze52-app-shell]")).toHaveAttribute(
      "data-account-sync-status",
      "saved",
    );
    await expect(
      b.getByRole("button", { name: "Montar meu ano", exact: true }),
    ).toHaveCount(0);
    // Offline operation meets a newer remote revision, without sharing storage.
    await mobile.setOffline(true);
    await a
      .locator(
        '[data-habits-prototype] button[aria-label^="Desmarcar Hábito QA continuidade"]',
      )
      .last()
      .click();
    await expect(a.locator("[data-doze52-app-shell]")).toHaveAttribute(
      "data-account-sync-status",
      "pending",
    );
    await b
      .locator(
        '[data-product-navigation="desktop"] [data-product-destination="habits"]',
      )
      .click();
    const markedDate = await b.evaluate(
      () =>
        Object.values(
          JSON.parse(localStorage.getItem("doze52:habits-view:v2") ?? "{}")
            .state.checkIns,
        ).find((c) => (c as { completed: boolean }).completed) as {
          date: string;
        },
    );
    await b
      .locator(`[data-habits-prototype] [data-day-iso="${markedDate.date}"]`)
      .click();
    await expect(b.locator("[data-doze52-app-shell]")).toHaveAttribute(
      "data-account-sync-status",
      "saved",
    );
    await mobile.setOffline(false);
    await a.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(
      a.getByRole("button", { name: "Reaplicar minha alteração / recuperar" }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Reaplicar minha alteração / recuperar" })
      .click();
    await expect(a.locator("[data-doze52-app-shell]")).toHaveAttribute(
      "data-account-sync-status",
      "saved",
    );
    await b.getByRole("button", { name: "Abrir perfil", exact: true }).click();
    await b.getByRole("button", { name: "Ajuda", exact: true }).click();
    await b
      .getByRole("button", { name: "Introdução ao Anual", exact: true })
      .click();
    await b
      .getByRole("button", { name: "Montar meu ano", exact: true })
      .click();
    await finishAnnual(b);
    await expect(b.locator("[data-doze52-app-shell]")).toHaveAttribute(
      "data-account-sync-status",
      "saved",
    );
    await a.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect
      .poll(() =>
        a.evaluate(
          () =>
            JSON.parse(localStorage.getItem("doze52:onboarding:v2") ?? "{}")
              .step,
        ),
      )
      .toBe("completed");
    await b.getByRole("button", { name: "Abrir perfil", exact: true }).click();
    await b.getByRole("button", { name: "Sair", exact: true }).click();
    await expect
      .poll(() =>
        b.evaluate(
          () =>
            JSON.parse(localStorage.getItem("doze52:habits-view:v2") ?? "{}")
              .state.habits.length,
        ),
      )
      .toBe(0);
  } finally {
    await mobile.close();
    await desktop.close();
  }
});

test("legacy import asks ownership, archives excess and preserves IDs on reload", async ({
  page,
}) => {
  test.skip(
    !existsSync(".vercel/continuity-qa.json"),
    "Requer a conta descartável de QA do Supabase DEV.",
  );
  const { email, password } = JSON.parse(
    readFileSync(".vercel/continuity-qa.json", "utf8"),
  );
  const legacyId = "f9520000-0000-4000-8000-000000000001";
  await page.addInitScript((id) => {
    if (localStorage.getItem("qa-legacy-seeded")) return;
    localStorage.setItem("qa-legacy-seeded", "true");
    localStorage.setItem(
      "doze52:habits-store:v1",
      JSON.stringify({
        state: {
          habits: [
            {
              id,
              name: "Hábito antigo QA",
              color: "#123456",
              icon: "circle-check",
              position: 0,
              createdAt: "2026-09-01",
              updatedAt: "2026-09-01",
            },
          ],
          checkIns: {
            [`${id}:2026-09-01`]: {
              habitId: id,
              date: "2026-09-01",
              completed: true,
              updatedAt: "2026-09-01",
            },
          },
          selectedHabitId: id,
          visibleHabitIds: [id],
        },
        version: 0,
      }),
    );
  }, legacyId);
  await openHome(page);
  await page.getByRole("button", { name: "Entrar na sua conta" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const prompt = page.getByRole("region", { name: "Importar hábitos" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("checkbox", { name: "Hábito antigo QA" }).check();
  await prompt.getByRole("button", { name: "Guardar nesta conta" }).click();
  await expect(page.locator("[data-doze52-app-shell]")).toHaveAttribute(
    "data-account-sync-status",
    "saved",
  );
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const view = JSON.parse(
          localStorage.getItem("doze52:habits-view:v2") ?? "{}",
        ).state;
        return {
          legacy: view.habits.filter((h: { id: string }) => h.id === id).length,
          active: view.habits.filter(
            (h: { archivedAt?: string }) => !h.archivedAt,
          ).length,
          completed: view.checkIns[`${id}:2026-09-01`]?.completed,
        };
      }, legacyId),
    )
    .toEqual({ legacy: 1, active: 1, completed: true });
  await page.reload();
  await expect(page.locator("[data-doze52-app-shell]")).toHaveAttribute(
    "data-account-sync-status",
    "saved",
  );
  await expect(prompt).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("doze52:habits-store:v1")),
  ).toBeTruthy();
});

test("switching accounts on one browser hides the previous account and its progress", async ({
  page,
}) => {
  test.skip(
    !existsSync(".vercel/continuity-qa.json") ||
      !existsSync(".vercel/continuity-qa-other.json"),
    "Requer as duas contas descartáveis de QA do Supabase DEV.",
  );
  const a = JSON.parse(readFileSync(".vercel/continuity-qa.json", "utf8"));
  const b = JSON.parse(
    readFileSync(".vercel/continuity-qa-other.json", "utf8"),
  );
  await openHome(page);
  const login = async (account: { email: string; password: string }) => {
    await page.getByRole("button", { name: "Entrar na sua conta" }).click();
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Senha", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.locator("[data-doze52-app-shell]")).toHaveAttribute(
      "data-account-sync-status",
      "saved",
    );
  };
  await login(a);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("doze52:habits-view:v2") ?? "{}")
            .state.habits.length,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Abrir perfil", exact: true }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("doze52:habits-view:v2") ?? "{}")
            .state.habits.length,
      ),
    )
    .toBe(0);
  await login(b);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("doze52:habits-view:v2") ?? "{}").state
          .habits.length,
    ),
  ).toBe(0);
  await expect(
    page.getByRole("button", { name: "Montar meu ano", exact: true }),
  ).toBeVisible();
});
