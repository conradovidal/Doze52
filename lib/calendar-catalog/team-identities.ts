import clubs from "@/lib/calendar-packs/brazilian-clubs-2026.json";

const normalize = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\b(?:saf|fc)\b/gi, "")
  .replace(/[^a-z0-9]+/gi, " ")
  .trim()
  .toLowerCase();

const byAlias = new Map(
  clubs.flatMap((club) => club.aliases.map((alias) => [normalize(alias), club] as const))
);
const byId = new Map(clubs.map((club) => [club.id, club] as const));

export const brazilianClubs2026 = clubs;

export const canonicalBrazilianClub = (name: string) => byAlias.get(normalize(name));
export const canonicalBrazilianClubById = (id: string) => byId.get(id);

export const canonicalTeamName = (name: string) => canonicalBrazilianClub(name)?.name ?? name.trim();

export const canonicalTeamId = (name: string, fallback?: string) =>
  canonicalBrazilianClub(name)?.id ?? fallback;
