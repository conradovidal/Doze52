export const PROFILE_ICON_IDS = [
  "briefcase",
  "user",
  "users",
  "home",
  "heart",
  "book-open",
  "graduation-cap",
  "plane",
  "stethoscope",
  "baby",
  "dumbbell",
  "folder",
] as const;

export type ProfileIconId = (typeof PROFILE_ICON_IDS)[number];

export const DEFAULT_PROFILE_ICON: ProfileIconId = "folder";

export const PROFILE_ICON_OPTIONS: Array<{ id: ProfileIconId; label: string }> = [
  { id: "briefcase", label: "Trabalho" },
  { id: "user", label: "Pessoal" },
  { id: "users", label: "Familia" },
  { id: "home", label: "Casa" },
  { id: "heart", label: "Bem-estar" },
  { id: "book-open", label: "Estudos" },
  { id: "graduation-cap", label: "Formacao" },
  { id: "plane", label: "Viagens" },
  { id: "stethoscope", label: "Saude" },
  { id: "baby", label: "Criancas" },
  { id: "dumbbell", label: "Fitness" },
  { id: "folder", label: "Geral" },
];

const PROFILE_ICON_ID_SET = new Set<string>(PROFILE_ICON_IDS);

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const isProfileIconId = (value: unknown): value is ProfileIconId =>
  typeof value === "string" && PROFILE_ICON_ID_SET.has(value);

export const inferProfileIconFromName = (name: string | undefined | null): ProfileIconId => {
  const normalized = normalizeName(name ?? "");
  if (!normalized) return DEFAULT_PROFILE_ICON;
  if (normalized.includes("profissional") || normalized.includes("trabalho")) {
    return "briefcase";
  }
  if (normalized.includes("pessoal")) return "user";
  if (normalized.includes("familia")) return "users";
  if (normalized.includes("casa")) return "home";
  if (normalized.includes("saude")) return "stethoscope";
  if (normalized.includes("estudo") || normalized.includes("escola")) {
    return "book-open";
  }
  if (normalized.includes("viagem")) return "plane";
  return DEFAULT_PROFILE_ICON;
};

export const normalizeProfileIconId = (
  value: unknown,
  fallbackName?: string | null
): ProfileIconId => {
  if (isProfileIconId(value)) return value;
  return inferProfileIconFromName(fallbackName);
};
