import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import clubs from "../lib/calendar-packs/brazilian-clubs-2026.json";
import { parseOfficialSource } from "../lib/calendar-catalog/parsers";
import { fetchGeFootballFeed, missingOfficialMatchIssues, reconcileGeFootballFeed } from "../lib/calendar-catalog/ge-feed";
import { deterministicCalendarUuid } from "../lib/calendar-catalog/ids";
import type { CalendarCatalogSource } from "../lib/calendar-catalog/types";

const main = async () => {
const verifiedAt = process.argv.find((argument) => argument.startsWith("--verified-at="))?.split("=")[1];
if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt ?? "")) throw new Error("Use --verified-at=AAAA-MM-DD.");
const previousRef = process.argv.find((argument) => argument.startsWith("--previous-ref="))?.split("=")[1];
const seedPath = resolve("lib/calendar-packs/brasileirao-2026-seed.json");
const previousSeed = JSON.parse(previousRef
  ? execFileSync("git", ["show", `${previousRef}:lib/calendar-packs/brasileirao-2026-seed.json`], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
  : readFileSync(seedPath, "utf8")) as {
    events: Array<Record<string, unknown> & { homeTeamId?: string; awayTeamId?: string }>;
    packVersions?: Record<string, number>;
  };

const sources: Record<string, CalendarCatalogSource> = {
  brasileirao: { id: "cbf-brasileirao-2026", authority: "CBF", competition: "Campeonato Brasileiro Serie A", season: 2026, official_url: "https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026?documento=Tabela%20Detalhada", parser_key: "cbf", feed_provider: "GE", feed_url: "https://ge.globo.com/futebol/brasileirao-serie-a/", rollout_status: "shadow", freshness_hours: 28, last_checked_at: null, last_successful_at: null, last_error: null },
  copa: { id: "cbf-copa-do-brasil-2026", authority: "CBF", competition: "Copa do Brasil", season: 2026, official_url: "https://www.cbf.com.br/futebol-brasileiro/tabelas/copa-do-brasil/masculino/2026?documento=Tabela%20Detalhada", parser_key: "cbf", feed_provider: "GE", feed_url: "https://ge.globo.com/futebol/copa-do-brasil/", rollout_status: "shadow", freshness_hours: 28, last_checked_at: null, last_successful_at: null, last_error: null },
  libertadores: { id: "conmebol-libertadores-2026", authority: "CONMEBOL", competition: "CONMEBOL Libertadores", season: 2026, official_url: "https://gol.conmebol.com/libertadores/pt-br/tournament/15", parser_key: "conmebol", feed_provider: "GE", feed_url: "https://ge.globo.com/futebol/libertadores/", rollout_status: "shadow", freshness_hours: 28, last_checked_at: null, last_successful_at: null, last_error: null },
  sudamericana: { id: "conmebol-sudamericana-2026", authority: "CONMEBOL", competition: "CONMEBOL Sul-Americana", season: 2026, official_url: "https://gol.conmebol.com/sudamericana/pt-br/tournament/104", parser_key: "conmebol", feed_provider: "GE", feed_url: "https://ge.globo.com/futebol/copa-sul-americana/", rollout_status: "shadow", freshness_hours: 28, last_checked_at: null, last_successful_at: null, last_error: null },
};

const documents = [
  { source: sources.brasileirao, url: "https://www.cbf.com.br/api/cbf/jogos/tabela-detalhada/campeonato/1260611", contentType: "application/json" },
  { source: sources.copa, url: "https://www.cbf.com.br/api/cbf/jogos/tabela-detalhada/campeonato/1260615", contentType: "application/json" },
  ...[5, 13, 3, 11, 714, 711].map((fixtureId) => ({
    source: sources.libertadores,
    url: `https://gol.conmebol.com/libertadores/pt-br/fixture/view/${fixtureId}`,
    contentType: "text/html",
  })),
  { source: sources.libertadores, url: "https://gol.conmebol.com/libertadores/es/news/calendario-conmebol-libertadores-2026-dias-horarios-y-sedes-de-la-fase-de-grupos", contentType: "text/html" },
  { source: sources.libertadores, url: "https://gol.conmebol.com/libertadores/pt-br/news/datas-e-horarios-assim-serao-disputadas-oitavas-de-final-da-conmebol-libertadores", contentType: "text/html" },
  { source: sources.sudamericana, url: "https://gol.conmebol.com/sudamericana/es/news/calendario-conmebol-sudamericana-2026-dias-horarios-y-sedes-de-la-fase-de-grupos", contentType: "text/html" },
  { source: sources.sudamericana, url: "https://gol.conmebol.com/sudamericana/pt-br/news/para-tomar-nota-assim-serao-disputados-os-playoffs-das-oitavas-de-final-da-conmebol", contentType: "text/html" },
  { source: sources.sudamericana, url: "https://gol.conmebol.com/sudamericana/pt-br/news/assim-serao-disputadas-oitavas-de-final-da-conmebol-sudamericana", contentType: "text/html" },
] as const;

const fetchOfficial = (url: string) => execFileSync("curl", [
  "--fail", "--location", "--compressed", "--silent", "--show-error",
  "--user-agent", "Doze52-Calendar-Updater/1.0 (+https://doze52.com)", url,
], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });

const clubIds = new Set(clubs.map((club) => club.id));
const officialEvents = documents.flatMap(({ source, url, contentType }) =>
  parseOfficialSource(fetchOfficial(url), contentType, source, { sourceUrl: url })
    .filter((event) => clubIds.has(event.homeTeamId ?? "") || clubIds.has(event.awayTeamId ?? ""))
    .map((event) => ({ source, event }))
);

const eventBatches = await Promise.all(Object.values(sources).map(async (source) => {
  const sourceOfficialEvents = officialEvents
    .filter((entry) => entry.source.id === source.id)
    .map((entry) => entry.event);
  const feedEvents = await fetchGeFootballFeed(source);
  const reconciliation = reconcileGeFootballFeed({ source, officialEvents: sourceOfficialEvents, feedEvents });
  const issues = [
    ...reconciliation.issues,
    ...missingOfficialMatchIssues(reconciliation.unmatchedFeedEvents),
  ];
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }
  console.log(`${source.id}: ${feedEvents.length} no GE, ${reconciliation.unmatchedFeedEvents.length} sem confirmação oficial.`);
  return reconciliation.reconciledEvents.map((event) => ({
    ...event,
    id: source.id === "cbf-brasileirao-2026" && /^\d{1,12}$/.test(event.externalId)
      ? `2026ba00-0000-4000-8000-${event.externalId.padStart(12, "0")}`
      : deterministicCalendarUuid(source.authority, source.competition, source.season, event.externalId),
    sourceId: source.id,
    sourceLabel: `${source.authority} — ${source.competition}`,
    sourceUrl: source.official_url,
  }));
}));

const events = eventBatches.flat();

const uniqueEvents = Array.from(new Map(events.map((event) => [`${event.sourceId}:${event.externalId}`, event])).values())
  .sort((left, right) => `${left.date}T${left.time}:${left.externalId}`.localeCompare(`${right.date}T${right.time}:${right.externalId}`));

const bySource = Object.fromEntries(Object.values(sources).map((source) => [source.id, uniqueEvents.filter((event) => event.sourceId === source.id).length]));
for (const source of Object.values(sources)) {
  if (!bySource[source.id]) throw new Error(`A fonte ${source.id} não produziu eventos dos 20 clubes.`);
}
if (clubs.length !== 20 || uniqueEvents.some((event) => event.date === "1900-01-01" || !event.time || event.time === "00:00")) {
  throw new Error("O seed contém clubes ou partidas inválidas.");
}

const eventsForClub = (entries: Array<Record<string, unknown> & { homeTeamId?: string; awayTeamId?: string }>, clubId: string) =>
  entries.filter((event) => event.homeTeamId === clubId || event.awayTeamId === clubId)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
const packVersions = Object.fromEntries(clubs.map((club) => {
  const previousVersion = previousSeed.packVersions?.[club.id] ?? (club.id === "20013" ? 6 : 2);
  const changed = JSON.stringify(eventsForClub(previousSeed.events, club.id)) !==
    JSON.stringify(eventsForClub(uniqueEvents, club.id));
  return [club.id, previousVersion + (changed ? 1 : 0)];
}));

writeFileSync(seedPath, `${JSON.stringify({
  verifiedAt,
  packVersions,
  sources: Object.values(sources).map((source) => ({ id: source.id, label: `${source.authority} — ${source.competition}`, url: source.official_url })),
  events: uniqueEvents,
}, null, 2)}\n`);
console.log(JSON.stringify({ clubs: clubs.length, events: uniqueEvents.length, bySource, packVersions }, null, 2));
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
