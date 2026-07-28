import type { ThemeMode } from "@/lib/theme-shared";

export type CategoryColorToken = {
  id: string;
  label: string;
  base: string;
  chipSoft: string;
  chipBorder: string;
  eventSoft: string;
  eventBorder: string;
  text: string;
};

export type ResolvedCategoryColorToken = CategoryColorToken & {
  soft: string;
  border: string;
  indicator: string;
};

export const CATEGORY_COLOR_BASE_BLUE = "#4F8FD6";
export const CATEGORY_COLOR_BASE_INDIGO = "#8EA5F7";
export const CATEGORY_COLOR_BASE_VIOLET = "#B79AEF";
export const CATEGORY_COLOR_BASE_PURPLE = "#C78AD9";
export const CATEGORY_COLOR_BASE_PINK = "#F09CCF";
export const CATEGORY_COLOR_BASE_ROSE = "#F4A6B8";
export const CATEGORY_COLOR_BASE_RED = "#EF8F8F";
export const CATEGORY_COLOR_BASE_ORANGE = "#EBA16D";
export const CATEGORY_COLOR_BASE_CORAL = "#EE9275";
export const CATEGORY_COLOR_BASE_AMBER = "#E7B957";
export const CATEGORY_COLOR_BASE_YELLOW = "#E1D15D";
export const CATEGORY_COLOR_BASE_LIME = "#A8CD6C";
export const CATEGORY_COLOR_BASE_GREEN = "#58B76F";
export const CATEGORY_COLOR_BASE_EMERALD = "#86C7A0";
export const CATEGORY_COLOR_BASE_MINT = "#5EC9C5";
export const CATEGORY_COLOR_BASE_TEAL = "#55B5A8";
export const CATEGORY_COLOR_BASE_CYAN = "#72CFE3";
export const CATEGORY_COLOR_BASE_SKY = "#93C5FD";
export const CATEGORY_COLOR_BASE_SLATE = "#CBD5E1";
export const CATEGORY_COLOR_BASE_ZINC = "#D0D3DA";
export const CATEGORY_COLOR_BASE_TERRA = "#D6A060";
export const CATEGORY_COLOR_BASE_OLIVE = "#B7B86F";
export const CATEGORY_COLOR_BASE_SAND = "#D9BE8C";
export const CATEGORY_COLOR_BASE_GRAPHITE = "#9CA6B4";
export const CATEGORY_COLOR_BASE_INK = "#1F2937";

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_BASE_BLUE;

export const CATEGORY_COLOR_TOKENS = [
  {
    id: "blue",
    label: "Azul",
    base: CATEGORY_COLOR_BASE_BLUE,
    chipSoft: "#DCEBFA",
    chipBorder: "#8EB7E7",
    eventSoft: "#73A7E0",
    eventBorder: "#4F8FD6",
    text: "#0E3767",
  },
  {
    id: "indigo",
    label: "Índigo",
    base: CATEGORY_COLOR_BASE_INDIGO,
    chipSoft: "#E8ECFF",
    chipBorder: "#B7C5FF",
    eventSoft: "#B7C5FF",
    eventBorder: "#8EA5F7",
    text: "#293A8E",
  },
  {
    id: "violet",
    label: "Violeta",
    base: CATEGORY_COLOR_BASE_VIOLET,
    chipSoft: "#F1EAFF",
    chipBorder: "#D8C4F6",
    eventSoft: "#D8C4F6",
    eventBorder: "#B79AEF",
    text: "#57348B",
  },
  {
    id: "purple",
    label: "Roxo",
    base: CATEGORY_COLOR_BASE_PURPLE,
    chipSoft: "#F6E9FB",
    chipBorder: "#E0B7EC",
    eventSoft: "#E0B7EC",
    eventBorder: "#C78AD9",
    text: "#6C307F",
  },
  {
    id: "pink",
    label: "Pink",
    base: CATEGORY_COLOR_BASE_PINK,
    chipSoft: "#FCE6F2",
    chipBorder: "#F5ABD0",
    eventSoft: "#F5ABD0",
    eventBorder: "#F09CCF",
    text: "#832B58",
  },
  {
    id: "rose",
    label: "Rosa",
    base: CATEGORY_COLOR_BASE_ROSE,
    chipSoft: "#FCE7EE",
    chipBorder: "#F4A6B8",
    eventSoft: "#F7B9C7",
    eventBorder: "#E38AA3",
    text: "#8A2444",
  },
  {
    id: "red",
    label: "Vermelho",
    base: CATEGORY_COLOR_BASE_RED,
    chipSoft: "#FDE5E5",
    chipBorder: "#F2A4A4",
    eventSoft: "#F2A4A4",
    eventBorder: "#EF8F8F",
    text: "#842222",
  },
  {
    id: "orange",
    label: "Laranja",
    base: CATEGORY_COLOR_BASE_ORANGE,
    chipSoft: "#FBE7D8",
    chipBorder: "#F1B07C",
    eventSoft: "#F1B07C",
    eventBorder: "#EBA16D",
    text: "#7D3F13",
  },
  {
    id: "coral",
    label: "Coral",
    base: CATEGORY_COLOR_BASE_CORAL,
    chipSoft: "#FCE5DE",
    chipBorder: "#F2AA96",
    eventSoft: "#F2AA96",
    eventBorder: "#EE9275",
    text: "#7E3524",
  },
  {
    id: "amber",
    label: "Âmbar",
    base: CATEGORY_COLOR_BASE_AMBER,
    chipSoft: "#F8EBCB",
    chipBorder: "#E7B957",
    eventSoft: "#ECC873",
    eventBorder: "#D3A13F",
    text: "#76510A",
  },
  {
    id: "yellow",
    label: "Amarelo",
    base: CATEGORY_COLOR_BASE_YELLOW,
    chipSoft: "#F8F0C9",
    chipBorder: "#E8D76E",
    eventSoft: "#E8D76E",
    eventBorder: "#E1D15D",
    text: "#685D09",
  },
  {
    id: "lime",
    label: "Lima",
    base: CATEGORY_COLOR_BASE_LIME,
    chipSoft: "#EAF4D2",
    chipBorder: "#B9D982",
    eventSoft: "#B9D982",
    eventBorder: "#A8CD6C",
    text: "#405F14",
  },
  {
    id: "green",
    label: "Verde",
    base: CATEGORY_COLOR_BASE_GREEN,
    chipSoft: "#DDF2E3",
    chipBorder: "#8BCF9B",
    eventSoft: "#73C987",
    eventBorder: "#58B76F",
    text: "#0F5224",
  },
  {
    id: "emerald",
    label: "Esmeralda",
    base: CATEGORY_COLOR_BASE_EMERALD,
    chipSoft: "#E1F3EA",
    chipBorder: "#9ED2B2",
    eventSoft: "#AAD8BC",
    eventBorder: "#78C198",
    text: "#1F5B3F",
  },
  {
    id: "mint",
    label: "Menta",
    base: CATEGORY_COLOR_BASE_MINT,
    chipSoft: "#D9F4F2",
    chipBorder: "#8ADAD7",
    eventSoft: "#7FD6D2",
    eventBorder: "#4BB8B3",
    text: "#0B5E5A",
  },
  {
    id: "teal",
    label: "Teal",
    base: CATEGORY_COLOR_BASE_TEAL,
    chipSoft: "#DDF2ED",
    chipBorder: "#82C9BE",
    eventSoft: "#82C9BE",
    eventBorder: "#55B5A8",
    text: "#155A51",
  },
  {
    id: "cyan",
    label: "Ciano",
    base: CATEGORY_COLOR_BASE_CYAN,
    chipSoft: "#DDF4FA",
    chipBorder: "#8CD8E8",
    eventSoft: "#8CD8E8",
    eventBorder: "#72CFE3",
    text: "#165E73",
  },
  {
    id: "sky",
    label: "Sky",
    base: CATEGORY_COLOR_BASE_SKY,
    chipSoft: "#DBECFF",
    chipBorder: "#93C5FD",
    eventSoft: "#A9D1FE",
    eventBorder: "#72ACEF",
    text: "#1D4E89",
  },
  {
    id: "slate",
    label: "Slate",
    base: CATEGORY_COLOR_BASE_SLATE,
    chipSoft: "#F1F5F9",
    chipBorder: "#CBD5E1",
    eventSoft: "#D7E0EA",
    eventBorder: "#AEBBCC",
    text: "#334155",
  },
  {
    id: "zinc",
    label: "Zinc",
    base: CATEGORY_COLOR_BASE_ZINC,
    chipSoft: "#F3F4F6",
    chipBorder: "#DADDE4",
    eventSoft: "#DADDE4",
    eventBorder: "#B9BEC8",
    text: "#3F3F46",
  },
  {
    id: "terra",
    label: "Terra",
    base: CATEGORY_COLOR_BASE_TERRA,
    chipSoft: "#F7E9D1",
    chipBorder: "#E4B87A",
    eventSoft: "#E4B87A",
    eventBorder: "#D6A060",
    text: "#704512",
  },
  {
    id: "olive",
    label: "Oliva",
    base: CATEGORY_COLOR_BASE_OLIVE,
    chipSoft: "#F0F0D9",
    chipBorder: "#CBCC91",
    eventSoft: "#CBCC91",
    eventBorder: "#B7B86F",
    text: "#555522",
  },
  {
    id: "sand",
    label: "Areia",
    base: CATEGORY_COLOR_BASE_SAND,
    chipSoft: "#F5EDDE",
    chipBorder: "#E2CAA0",
    eventSoft: "#E2CAA0",
    eventBorder: "#D9BE8C",
    text: "#654D25",
  },
  {
    id: "graphite",
    label: "Grafite",
    base: CATEGORY_COLOR_BASE_GRAPHITE,
    chipSoft: "#E8EBEF",
    chipBorder: "#C5CDD6",
    eventSoft: "#C5CDD6",
    eventBorder: "#9CA6B4",
    text: "#18202B",
  },
] as const satisfies readonly CategoryColorToken[];

export const CATEGORY_COLOR_SETS = [
  {
    id: "pastel",
    label: "Pastel",
    colors: [
      CATEGORY_COLOR_BASE_YELLOW,
      CATEGORY_COLOR_BASE_AMBER,
      CATEGORY_COLOR_BASE_ORANGE,
      CATEGORY_COLOR_BASE_CORAL,
      CATEGORY_COLOR_BASE_RED,
      CATEGORY_COLOR_BASE_ROSE,
      CATEGORY_COLOR_BASE_PINK,
      CATEGORY_COLOR_BASE_PURPLE,
      CATEGORY_COLOR_BASE_VIOLET,
      CATEGORY_COLOR_BASE_INDIGO,
      CATEGORY_COLOR_BASE_BLUE,
      CATEGORY_COLOR_BASE_SKY,
      CATEGORY_COLOR_BASE_CYAN,
      CATEGORY_COLOR_BASE_MINT,
      CATEGORY_COLOR_BASE_TEAL,
      CATEGORY_COLOR_BASE_EMERALD,
      CATEGORY_COLOR_BASE_GREEN,
      CATEGORY_COLOR_BASE_LIME,
      CATEGORY_COLOR_BASE_OLIVE,
      CATEGORY_COLOR_BASE_TERRA,
      CATEGORY_COLOR_BASE_SAND,
      CATEGORY_COLOR_BASE_SLATE,
      CATEGORY_COLOR_BASE_ZINC,
      CATEGORY_COLOR_BASE_GRAPHITE,
    ],
  },
] as const;

export const CATEGORY_PRESET_COLORS = CATEGORY_COLOR_SETS.flatMap((set) => set.colors);

const CATEGORY_PRESET_COLOR_SET = new Set(
  CATEGORY_PRESET_COLORS.map((color) => color.toLowerCase())
);

const CATEGORY_COLOR_TOKEN_BY_BASE = new Map(
  CATEGORY_COLOR_TOKENS.map((token) => [token.base.toLowerCase(), token])
);

const CATEGORY_COLOR_ALIASES = new Map<string, string>([
  ["#2563eb", CATEGORY_COLOR_BASE_BLUE],
  ["#4f46e5", CATEGORY_COLOR_BASE_INDIGO],
  ["#7c3aed", CATEGORY_COLOR_BASE_VIOLET],
  ["#9333ea", CATEGORY_COLOR_BASE_PURPLE],
  ["#db2777", CATEGORY_COLOR_BASE_PINK],
  ["#e11d48", CATEGORY_COLOR_BASE_ROSE],
  ["#dc2626", CATEGORY_COLOR_BASE_RED],
  ["#ea580c", CATEGORY_COLOR_BASE_ORANGE],
  ["#f97316", CATEGORY_COLOR_BASE_CORAL],
  ["#d97706", CATEGORY_COLOR_BASE_AMBER],
  ["#ca8a04", CATEGORY_COLOR_BASE_YELLOW],
  ["#65a30d", CATEGORY_COLOR_BASE_LIME],
  ["#16a34a", CATEGORY_COLOR_BASE_GREEN],
  ["#059669", CATEGORY_COLOR_BASE_EMERALD],
  ["#0d9488", CATEGORY_COLOR_BASE_MINT],
  ["#0f766e", CATEGORY_COLOR_BASE_MINT],
  ["#14b8a6", CATEGORY_COLOR_BASE_TEAL],
  ["#0891b2", CATEGORY_COLOR_BASE_CYAN],
  ["#0284c7", CATEGORY_COLOR_BASE_SKY],
  ["#475569", CATEGORY_COLOR_BASE_SLATE],
  ["#52525b", CATEGORY_COLOR_BASE_ZINC],
  ["#a16207", CATEGORY_COLOR_BASE_TERRA],
  ["#7c8a35", CATEGORY_COLOR_BASE_OLIVE],
  ["#b08968", CATEGORY_COLOR_BASE_SAND],
  ["#1f2937", CATEGORY_COLOR_BASE_GRAPHITE],
]);

const normalizeHex = (value: string | undefined | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(withHash)) return null;

  const hex = withHash.slice(1);
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((part) => `${part}${part}`)
      .join("")
      .toUpperCase()}`;
  }

  return `#${hex.toUpperCase()}`;
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const int = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

type OklabColor = {
  l: number;
  a: number;
  b: number;
};

const srgbChannelToLinear = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const hexToOklab = (hex: string): OklabColor | null => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const red = srgbChannelToLinear(rgb.r);
  const green = srgbChannelToLinear(rgb.g);
  const blue = srgbChannelToLinear(rgb.b);

  const lRoot = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  );
  const mRoot = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  );
  const sRoot = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
  );

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
};

const CATEGORY_COLOR_OKLAB_BY_BASE = new Map(
  CATEGORY_PRESET_COLORS.map((color) => [color, hexToOklab(color)])
);

export const getNearestCategoryColor = (value: string | undefined | null) => {
  const normalized = normalizeHex(value);
  if (!normalized) return DEFAULT_CATEGORY_COLOR;
  const normalizedKey = normalized.toLowerCase();
  const aliasedColor = CATEGORY_COLOR_ALIASES.get(normalizedKey);
  if (aliasedColor) return aliasedColor;
  if (CATEGORY_PRESET_COLOR_SET.has(normalizedKey)) return normalized;

  const target = hexToOklab(normalized);
  if (!target) return DEFAULT_CATEGORY_COLOR;

  let nearest = DEFAULT_CATEGORY_COLOR;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of CATEGORY_PRESET_COLORS) {
    const candidateColor = CATEGORY_COLOR_OKLAB_BY_BASE.get(candidate);
    if (!candidateColor) continue;
    const distance =
      (target.l - candidateColor.l) ** 2 +
      (target.a - candidateColor.a) ** 2 +
      (target.b - candidateColor.b) ** 2;
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearest = candidate;
    }
  }

  return nearest;
};

export const getCategoryColorToken = (
  value: string | undefined | null,
  mode: ThemeMode = "light"
): ResolvedCategoryColorToken => {
  if (normalizeHex(value)?.toLowerCase() === CATEGORY_COLOR_BASE_INK.toLowerCase()) {
    return {
      id: "ink",
      label: "Preto",
      base: CATEGORY_COLOR_BASE_INK,
      chipSoft: CATEGORY_COLOR_BASE_INK,
      chipBorder: mode === "dark" ? "#64748B" : "#111827",
      eventSoft: CATEGORY_COLOR_BASE_INK,
      eventBorder: mode === "dark" ? "#94A3B8" : "#111827",
      text: "#F8FAFC",
      soft: CATEGORY_COLOR_BASE_INK,
      border: mode === "dark" ? "#64748B" : "#111827",
      indicator: CATEGORY_COLOR_BASE_INK,
    };
  }

  const nearestColor = getNearestCategoryColor(value);
  const token =
    CATEGORY_COLOR_TOKEN_BY_BASE.get(nearestColor.toLowerCase()) ??
    CATEGORY_COLOR_TOKEN_BY_BASE.get(DEFAULT_CATEGORY_COLOR.toLowerCase()) ??
    CATEGORY_COLOR_TOKENS[0];

  return {
    ...token,
    soft: token.chipSoft,
    border: token.chipBorder,
    indicator: token.base,
  };
};

export const ONBOARDING_CATEGORY_COLOR_BY_ID: Record<string, string> = {
  "11111111-1111-4111-8111-111111111111": CATEGORY_COLOR_BASE_AMBER,
  "22222222-2222-4222-8222-222222222222": CATEGORY_COLOR_BASE_EMERALD,
  "33333333-3333-4333-8333-333333333333": CATEGORY_COLOR_BASE_ROSE,
};
