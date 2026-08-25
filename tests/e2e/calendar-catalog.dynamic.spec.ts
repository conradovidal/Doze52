import { expect, test } from "@playwright/test";
import { applyOfficialSourceToCatalog } from "../../lib/calendar-catalog/catalog-builder";
import { materialHash } from "../../lib/calendar-catalog/material";
import type { CalendarCatalog, OfficialCalendarEvent } from "../../lib/calendar-catalog/types";
import clubs from "../../lib/calendar-packs/brazilian-clubs-2026.json";
import { dismissOnboardingIfVisible } from "./support/browser";

test("fallback compilado pré-seleciona São Paulo e Grêmio entre as opções disponíveis", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await dismissOnboardingIfVisible(page);
  await page.getByRole("button", { name: "Adicionar ou gerenciar calendários." }).click();
  const dialog = page.getByRole("dialog", { name: "Calendários" });
  await expect(
    dialog.getByRole("combobox", { name: /Estado para/ })
  ).toContainText("São Paulo (SP)");
  const selector = dialog.getByRole("combobox", { name: /Time para/ });
  await expect(selector).toContainText("Grêmio");
  await selector.click();
  const options = page.getByRole("option");
  await expect(options).toHaveCount(20);
  const labels = await options.allTextContents();
  expect(labels).toEqual([...labels].sort((left, right) => left.localeCompare(right, "pt-BR")));
  expect(labels[0]).not.toBe("Grêmio");
  await page.keyboard.press("Escape");

  const catalog = await page.evaluate(async () => (await fetch("/api/calendar-packs")).json());
  const palmeiras = catalog.packs.find((pack: { variantGroup?: { optionLabel?: string } }) => pack.variantGroup?.optionLabel === "Palmeiras");
  expect(new Set(palmeiras.events.map((event: { competition?: string }) => event.competition)).has("CONMEBOL Libertadores")).toBe(true);
  expect(palmeiras.events.some((event: { competition?: string; result?: string; notes?: string[] }) =>
    event.competition === "CONMEBOL Libertadores" && Boolean(event.result) && event.notes?.includes("Resultado operacional: GE.")
  )).toBe(true);
  expect(palmeiras.events.filter((event: { competition?: string }) => event.competition?.includes("CONMEBOL"))
    .every((event: { sourceUrl?: string }) => event.sourceUrl?.includes("conmebol.com"))).toBe(true);
  const athletico = catalog.packs.find((pack: { variantGroup?: { optionLabel?: string } }) => pack.variantGroup?.optionLabel === "Athletico Paranaense");
  expect(athletico.events.some((event: { competition?: string }) => event.competition?.includes("CONMEBOL"))).toBe(false);
});

test("catálogo remoto oferece 20 clubes e consulta uma nova versão sem deploy", async ({ page }) => {
  const source = {
    id: "cbf-brasileirao-2026", authority: "CBF",
    competition: "Campeonato Brasileiro Serie A", season: 2026,
    official_url: "https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026",
    parser_key: "cbf", rollout_status: "active" as const, freshness_hours: 28,
    feed_provider: null, feed_url: null,
    last_checked_at: null, last_successful_at: null, last_error: null,
  };
  const makeMatch = (index: number, homeTeam: string, awayTeam: string): OfficialCalendarEvent => ({
    externalId: String(900000 + index), competition: source.competition, season: 2026,
    date: `2026-09-${String(index + 1).padStart(2, "0")}`, time: "20:00",
    timezone: "America/Sao_Paulo", city: "São Paulo", venue: "Estádio",
    phase: "Rodada 1", homeTeam, awayTeam,
  });
  const teams = clubs.map((club) => club.name);
  const baseEvents = Array.from({ length: 10 }, (_, index) =>
    makeMatch(index, teams[index * 2], teams[index * 2 + 1])
  );
  const toCatalog = (events: OfficialCalendarEvent[], version: number): CalendarCatalog => {
    const packs = applyOfficialSourceToCatalog([], source, events);
    return { schemaVersion: 1, releaseId: `release-${version}`, version, publishedAt: new Date().toISOString(), materialHash: materialHash(packs), packs };
  };
  let catalog = toCatalog(baseEvents, 1);
  let requests = 0;
  await page.route("**/api/calendar-packs", async (route) => {
    requests += 1;
    await route.fulfill({ json: catalog });
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await dismissOnboardingIfVisible(page);
  await page.getByRole("button", { name: "Adicionar ou gerenciar calendários." }).click();
  const dialog = page.getByRole("dialog", { name: "Calendários" });
  await dialog.getByRole("combobox", { name: /Time para Jogos do/ }).click();
  await expect(page.getByRole("option")).toHaveCount(20);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  catalog = toCatalog([...baseEvents, makeMatch(11, "Palmeiras", "Corinthians")], 2);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => requests).toBeGreaterThan(1);
});
