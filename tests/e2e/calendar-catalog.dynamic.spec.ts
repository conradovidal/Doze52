import { expect, test } from "@playwright/test";
import { applyOfficialSourceToCatalog } from "../../lib/calendar-catalog/catalog-builder";
import { materialHash } from "../../lib/calendar-catalog/material";
import type { CalendarCatalog, OfficialCalendarEvent } from "../../lib/calendar-catalog/types";
import { dismissOnboardingIfVisible } from "./support/browser";

test("catálogo remoto oferece 20 clubes e recebe nova opção sem deploy", async ({ page }) => {
  const source = {
    id: "cbf-brasileirao-2026", authority: "CBF",
    competition: "Campeonato Brasileiro Serie A", season: 2026,
    official_url: "https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026",
    parser_key: "cbf", rollout_status: "active" as const, freshness_hours: 28,
    last_checked_at: null, last_successful_at: null, last_error: null,
  };
  const makeMatch = (index: number, homeTeam: string, awayTeam: string): OfficialCalendarEvent => ({
    externalId: String(900000 + index), competition: source.competition, season: 2026,
    date: `2026-09-${String(index + 1).padStart(2, "0")}`, time: "20:00",
    timezone: "America/Sao_Paulo", city: "São Paulo", venue: "Estádio",
    phase: "Rodada 1", homeTeam, awayTeam,
  });
  const teams = Array.from({ length: 20 }, (_, index) => `Clube ${index + 1}`);
  const baseEvents = Array.from({ length: 10 }, (_, index) =>
    makeMatch(index, teams[index * 2], teams[index * 2 + 1])
  );
  const toCatalog = (events: OfficialCalendarEvent[], version: number): CalendarCatalog => {
    const packs = applyOfficialSourceToCatalog([], source, events);
    return { schemaVersion: 1, releaseId: `release-${version}`, version, publishedAt: new Date().toISOString(), materialHash: materialHash(packs), packs };
  };
  let catalog = toCatalog(baseEvents, 1);
  await page.route("**/api/calendar-packs", async (route) => route.fulfill({ json: catalog }));

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await dismissOnboardingIfVisible(page);
  await page.getByRole("button", { name: "Adicionar ou gerenciar calendários." }).click();
  const dialog = page.getByRole("dialog", { name: "Calendários" });
  await dialog.getByRole("combobox", { name: /Time para Jogos do/ }).click();
  await expect(page.getByRole("option")).toHaveCount(20);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  catalog = toCatalog([...baseEvents, makeMatch(11, "Clube 21", "Clube 1")], 2);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("button", { name: "Adicionar ou gerenciar calendários." }).click();
  await dialog.getByRole("combobox", { name: /Time para Jogos do/ }).click();
  await expect(page.getByRole("option", { name: "Clube 21" })).toBeVisible();
});
