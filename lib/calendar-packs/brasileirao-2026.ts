import seed from "./brasileirao-2026-seed.json";
import type { CalendarPack, CalendarPackEvent } from "./types";

const PROFILE_ID = "2026ba00-0000-4000-8000-000000000001";
const CATEGORY_ID = "2026ba00-0000-4000-8000-000000000002";
const GREMIO_ID = "20013";
const DISPLAY_NAMES: Record<string, string> = {
  "61590": "Coritiba",
  "20008": "Santos",
  "60646": "Vasco da Gama",
};

const slug = (value: string) => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const canonicalEventId = (externalId: string) =>
  `2026ba00-0000-4000-8000-${externalId.padStart(12, "0")}`;

const teams = Array.from(new Map(seed.events.flatMap((event) => [
  [event.homeTeamId, DISPLAY_NAMES[event.homeTeamId] ?? event.homeTeam],
  [event.awayTeamId, DISPLAY_NAMES[event.awayTeamId] ?? event.awayTeam],
])).entries()).sort((left, right) => {
  if (left[0] === GREMIO_ID) return -1;
  if (right[0] === GREMIO_ID) return 1;
  return left[1].localeCompare(right[1], "pt-BR");
});

const toEvent = (match: (typeof seed.events)[number]): CalendarPackEvent => {
  const hasResult = match.homeGoals !== null && match.awayGoals !== null;
  return {
    id: canonicalEventId(match.externalId),
    title: hasResult
      ? `${match.homeTeam} ${match.homeGoals} x ${match.awayGoals} ${match.awayTeam}`
      : `${match.homeTeam} x ${match.awayTeam}`,
    date: match.date,
    time: match.time,
    timezone: "America/Sao_Paulo",
    city: [match.city, match.state].filter(Boolean).join(" - "),
    venue: match.venue,
    phase: `Rodada ${match.round}`,
    competition: "Campeonato Brasileiro",
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    suggestedCategoryKey: "favorite-team-2026",
    source: seed.source.label,
    sourceUrl: seed.source.url,
    lastVerified: seed.source.lastVerified,
    result: hasResult ? `${match.homeGoals} x ${match.awayGoals}` : undefined,
    notes: [`ID oficial CBF: ${match.externalId}.`],
    isBrazilMatch: false,
  };
};

const createPack = (teamId: string, teamName: string): CalendarPack => ({
  id: `brasileirao-2026-${slug(teamName)}`,
  version: teamId === GREMIO_ID ? 5 : 1,
  name: `Jogos do ${teamName}`,
  eyebrow: teamName,
  icon: "soccer-ball",
  description: "Jogos oficialmente confirmados do Brasileirão 2026.",
  variantGroup: { id: "brasileirao-2026-by-team", label: "Time", optionLabel: teamName, selectionMode: "replace" },
  year: 2026,
  datasetStatus: "seed",
  updateNote: "Partidas com data e horário oficialmente detalhados pela CBF.",
  source: { label: seed.source.label, url: seed.source.url, lastVerified: seed.source.lastVerified },
  profile: { id: PROFILE_ID, name: `Jogos do ${teamName}`, icon: "calendar-days" },
  categories: [{ id: CATEGORY_ID, key: "favorite-team-2026", name: `Jogos do ${teamName}`, color: "#2563EB", legacyNames: ["Brasileirão 2026"] }],
  legacyCategoryIds: ["brasileirao-2026-category"],
  events: seed.events
    .filter((event) => event.homeTeamId === teamId || event.awayTeamId === teamId)
    .map(toEvent),
});

export const brasileirao2026Packs = teams.map(([teamId, teamName]) => createPack(teamId, teamName));
