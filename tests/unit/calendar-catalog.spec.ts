import { expect, test } from "@playwright/test";
import { deterministicCalendarUuid } from "../../lib/calendar-catalog/ids";
import { diffCatalogs, incrementChangedPackVersions, materialHash } from "../../lib/calendar-catalog/material";
import { parseOfficialSource } from "../../lib/calendar-catalog/parsers";
import { validateOfficialCandidate } from "../../lib/calendar-catalog/validation";
import { applyOfficialSourceToCatalog } from "../../lib/calendar-catalog/catalog-builder";
import type { CalendarCatalogSource, OfficialCalendarEvent } from "../../lib/calendar-catalog/types";
import type { CalendarPack } from "../../lib/calendar-packs/types";

const source = (parser_key: string): CalendarCatalogSource => ({
  id: `source-${parser_key}`, authority: "Autoridade", competition: "Competição",
  season: 2026, official_url: "https://oficial.example/calendario", parser_key,
  rollout_status: "shadow", freshness_hours: 28, last_checked_at: null,
  last_successful_at: null, last_error: null,
});

const event = (overrides: Partial<OfficialCalendarEvent> = {}): OfficialCalendarEvent => ({
  externalId: "42", competition: "Competição", season: 2026, date: "2026-08-11",
  time: "21:30", timezone: "America/Sao_Paulo", city: "São Paulo", venue: "Estádio",
  phase: "Rodada 1", homeTeam: "Time A", awayTeam: "Time B", ...overrides,
});

const pack = (version = 1, lastVerified = "2026-08-10", title = "Time A x Time B"): CalendarPack => ({
  id: "pack", version, name: "Pack", description: "Pack", icon: "calendar", year: 2026,
  datasetStatus: "complete", updateNote: "", source: { label: "Fonte", url: "https://oficial.example", lastVerified },
  profile: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Perfil", icon: "calendar-days" },
  categories: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", key: "games", name: "Jogos", color: "#000000" }],
  events: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title, date: "2026-08-11", time: "21:30", timezone: "America/Sao_Paulo", city: "São Paulo", venue: "Estádio", phase: "Rodada 1", homeTeam: "Time A", awayTeam: "Time B", suggestedCategoryKey: "games", source: "Fonte", sourceUrl: "https://oficial.example", lastVerified, isBrazilMatch: false }],
});

test("hash e versão ignoram lastVerified, mas reconhecem mudança material", () => {
  expect(materialHash(pack(1, "2026-08-10"))).toBe(materialHash(pack(1, "2026-08-11")));
  expect(incrementChangedPackVersions([pack(4)], [pack(1, "2026-08-11")])[0].version).toBe(4);
  expect(incrementChangedPackVersions([pack(4)], [pack(1, "2026-08-11", "Time A 1 x 0 Time B")])[0].version).toBe(5);
  expect(diffCatalogs([pack()], [pack(1, "2026-08-11")]).changed).toEqual([]);
});

test("IDs determinísticos são estáveis e isolados por autoridade", () => {
  const first = deterministicCalendarUuid("CBF", "Brasileirão", 2026, "42");
  expect(first).toBe(deterministicCalendarUuid("CBF", "Brasileirão", 2026, "42"));
  expect(first).not.toBe(deterministicCalendarUuid("FIFA", "Brasileirão", 2026, "42"));
  expect(first).toMatch(/^[0-9a-f-]{36}$/);
});

test("quarentena bloqueia vazio, remoção excessiva e troca de participantes", () => {
  expect(validateOfficialCandidate({ previous: [], candidate: [] })[0].code).toBe("empty_source");
  const previous = Array.from({ length: 60 }, (_, index) => event({ externalId: String(index) }));
  const reduced = previous.slice(0, 56);
  expect(validateOfficialCandidate({ previous, candidate: reduced }).map((issue) => issue.code)).toContain("excessive_removal");
  expect(validateOfficialCandidate({ previous: [event()], candidate: [event({ awayTeam: "Time C" })] }).map((issue) => issue.code)).toContain("participants_changed");
  expect(validateOfficialCandidate({ previous: [event({ placeholder: true })], candidate: [event({ awayTeam: "Time C" })] })).toEqual([]);
});

test("parser normaliza contrato CBF/CONMEBOL/FIFA", () => {
  for (const parser of ["cbf", "conmebol", "fifa"]) {
    const events = parseOfficialSource(JSON.stringify({ matches: [{ id: 42, date: "2026-08-11", time: "21:30", homeTeam: { id: 1, name: "Time A" }, awayTeam: { id: 2, name: "Time B" }, homeScore: 2, awayScore: 1, venue: { name: "Estádio", city: "São Paulo" }, round: "Oitavas" }] }), "application/json", source(parser));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ externalId: "42", result: "2 x 1", homeTeam: "Time A", awayTeam: "Time B" });
  }
});

test("parser normaliza contratos de F1 e feriados governamentais", () => {
  const f1 = parseOfficialSource(JSON.stringify({ races: [{ round: 1, startDate: "2026-03-08T15:00:00", raceName: "GP da Austrália", circuit: "Albert Park" }] }), "application/json", source("formula1"));
  expect(f1[0]).toMatchObject({ externalId: "1", homeTeam: "GP da Austrália", awayTeam: "Fórmula 1" });
  const holidays = parseOfficialSource(JSON.stringify({ holidays: [{ date: "2026-09-07", name: "Independência do Brasil" }] }), "application/json", source("government_holidays"));
  expect(holidays[0]).toMatchObject({ homeTeam: "Independência do Brasil", awayTeam: "Feriado" });
});

test("parser reconhece os cards HTML do calendário oficial da F1", () => {
  const html = `<a class="group" href="/en/racing/2026/australia"><span>ROUND 1</span><span>06 - 08 Mar</span><p>Australia</p><span>FORMULA 1 QATAR AIRWAYS AUSTRALIAN GRAND PRIX 2026</span></a>`;
  expect(parseOfficialSource(html, "text/html", source("formula1"))[0]).toMatchObject({
    externalId: "1", date: "2026-03-08", homeTeam: "Australia",
  });
});

test("uma carga oficial do Brasileirão produz as 20 opções de clubes sem deploy", () => {
  const teams = Array.from({ length: 20 }, (_, index) => `Clube ${index + 1}`);
  const matches = Array.from({ length: 10 }, (_, index) => event({
    externalId: String(100 + index), homeTeam: teams[index * 2], awayTeam: teams[index * 2 + 1],
  }));
  const result = applyOfficialSourceToCatalog([], { ...source("cbf"), id: "cbf-brasileirao-2026" }, matches);
  expect(result).toHaveLength(20);
  expect(new Set(result.map((candidate) => candidate.variantGroup?.optionLabel)).size).toBe(20);
});
