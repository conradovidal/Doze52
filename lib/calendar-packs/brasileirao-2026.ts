import clubs from "./brazilian-clubs-2026.json";
import seed from "./brasileirao-2026-seed.json";
import type { CalendarPack, CalendarPackEvent } from "./types";

const PROFILE_ID = "2026ba00-0000-4000-8000-000000000001";
const CATEGORY_ID = "2026ba00-0000-4000-8000-000000000002";
const GREMIO_ID = "20013";

const slug = (value: string) => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const teams = [...clubs].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

type SeedMatch = (typeof seed.events)[number] & {
  resultProvider?: string;
  penaltyResult?: string;
};

const toEvent = (match: SeedMatch): CalendarPackEvent => ({
  id: match.id,
  title: match.result
    ? `${match.homeTeam} ${match.result} ${match.awayTeam}`
    : `${match.homeTeam} x ${match.awayTeam}`,
  date: match.date,
  time: match.time,
  timezone: match.timezone,
  city: match.city,
  venue: match.venue,
  phase: match.phase,
  competition: match.competition,
  homeTeam: match.homeTeam,
  awayTeam: match.awayTeam,
  suggestedCategoryKey: "favorite-team-2026",
  source: match.sourceLabel,
  sourceUrl: match.sourceUrl,
  lastVerified: seed.verifiedAt,
  result: match.result,
  notes: [
    `Referência oficial ${match.sourceId}: ${match.externalId}.`,
    ...(match.resultProvider ? [`Resultado operacional: ${match.resultProvider}.`] : []),
    ...(match.penaltyResult ? [`Pênaltis: ${match.penaltyResult}.`] : []),
  ],
  isBrazilMatch: false,
});

const createPack = (teamId: string, teamName: string): CalendarPack => ({
  id: `brasileirao-2026-${slug(teamName)}`,
  version: seed.packVersions[teamId as keyof typeof seed.packVersions] ?? (teamId === GREMIO_ID ? 6 : 2),
  name: `Jogos do ${teamName}`,
  eyebrow: teamName,
  icon: "soccer-ball",
  description: "Jogos oficialmente confirmados nas competições nacionais e continentais cobertas.",
  variantGroup: { id: "brasileirao-2026-by-team", label: "Time", optionLabel: teamName, selectionMode: "replace" },
  year: 2026,
  datasetStatus: "seed",
  updateNote: "Brasileirão, Copa do Brasil, Libertadores e Sul-Americana, conforme a participação do clube.",
  source: {
    label: "CBF e CONMEBOL — calendários oficiais de 2026",
    url: seed.sources[0].url,
    lastVerified: seed.verifiedAt,
  },
  profile: { id: PROFILE_ID, name: `Jogos do ${teamName}`, icon: "calendar-days" },
  categories: [{ id: CATEGORY_ID, key: "favorite-team-2026", name: `Jogos do ${teamName}`, color: "#2563EB", legacyNames: ["Brasileirão 2026"] }],
  legacyCategoryIds: ["brasileirao-2026-category"],
  events: seed.events
    .filter((event) => event.homeTeamId === teamId || event.awayTeamId === teamId)
    .map(toEvent)
    .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`)),
});

export const brasileirao2026Packs = teams.map((team) => createPack(team.id, team.name));
