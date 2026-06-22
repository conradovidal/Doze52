export type CategoryColorToken = {
  id: string;
  label: string;
  base: string;
  soft: string;
  border: string;
  text: string;
};

export const CATEGORY_COLOR_BASE_BLUE = "#2563EB";
export const CATEGORY_COLOR_BASE_INDIGO = "#4F46E5";
export const CATEGORY_COLOR_BASE_VIOLET = "#7C3AED";
export const CATEGORY_COLOR_BASE_PURPLE = "#9333EA";
export const CATEGORY_COLOR_BASE_PINK = "#DB2777";
export const CATEGORY_COLOR_BASE_ROSE = "#E11D48";
export const CATEGORY_COLOR_BASE_RED = "#DC2626";
export const CATEGORY_COLOR_BASE_ORANGE = "#EA580C";
export const CATEGORY_COLOR_BASE_AMBER = "#D97706";
export const CATEGORY_COLOR_BASE_YELLOW = "#CA8A04";
export const CATEGORY_COLOR_BASE_LIME = "#65A30D";
export const CATEGORY_COLOR_BASE_GREEN = "#16A34A";
export const CATEGORY_COLOR_BASE_EMERALD = "#059669";
export const CATEGORY_COLOR_BASE_MINT = "#0D9488";
export const CATEGORY_COLOR_BASE_CYAN = "#0891B2";
export const CATEGORY_COLOR_BASE_SKY = "#0284C7";
export const CATEGORY_COLOR_BASE_SLATE = "#475569";
export const CATEGORY_COLOR_BASE_ZINC = "#52525B";
export const CATEGORY_COLOR_BASE_TERRA = "#A16207";
export const CATEGORY_COLOR_BASE_GRAPHITE = "#1F2937";

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_BASE_BLUE;

export const CATEGORY_COLOR_TOKENS = [
  {
    id: "blue",
    label: "Azul",
    base: CATEGORY_COLOR_BASE_BLUE,
    soft: "#DBEAFE",
    border: "#BFDBFE",
    text: "#1E3A8A",
  },
  {
    id: "indigo",
    label: "Índigo",
    base: CATEGORY_COLOR_BASE_INDIGO,
    soft: "#E0E7FF",
    border: "#C7D2FE",
    text: "#3730A3",
  },
  {
    id: "violet",
    label: "Violeta",
    base: CATEGORY_COLOR_BASE_VIOLET,
    soft: "#EDE9FE",
    border: "#DDD6FE",
    text: "#5B21B6",
  },
  {
    id: "purple",
    label: "Roxo",
    base: CATEGORY_COLOR_BASE_PURPLE,
    soft: "#F3E8FF",
    border: "#E9D5FF",
    text: "#6B21A8",
  },
  {
    id: "pink",
    label: "Pink",
    base: CATEGORY_COLOR_BASE_PINK,
    soft: "#FCE7F3",
    border: "#FBCFE8",
    text: "#9D174D",
  },
  {
    id: "rose",
    label: "Rosa",
    base: CATEGORY_COLOR_BASE_ROSE,
    soft: "#FFE4E6",
    border: "#FECDD3",
    text: "#9F1239",
  },
  {
    id: "red",
    label: "Vermelho",
    base: CATEGORY_COLOR_BASE_RED,
    soft: "#FEE2E2",
    border: "#FECACA",
    text: "#991B1B",
  },
  {
    id: "orange",
    label: "Laranja",
    base: CATEGORY_COLOR_BASE_ORANGE,
    soft: "#FFEDD5",
    border: "#FED7AA",
    text: "#9A3412",
  },
  {
    id: "amber",
    label: "Âmbar",
    base: CATEGORY_COLOR_BASE_AMBER,
    soft: "#FEF3C7",
    border: "#FDE68A",
    text: "#92400E",
  },
  {
    id: "yellow",
    label: "Amarelo",
    base: CATEGORY_COLOR_BASE_YELLOW,
    soft: "#FEF9C3",
    border: "#FEF08A",
    text: "#854D0E",
  },
  {
    id: "lime",
    label: "Lima",
    base: CATEGORY_COLOR_BASE_LIME,
    soft: "#ECFCCB",
    border: "#D9F99D",
    text: "#3F6212",
  },
  {
    id: "green",
    label: "Verde",
    base: CATEGORY_COLOR_BASE_GREEN,
    soft: "#DCFCE7",
    border: "#BBF7D0",
    text: "#166534",
  },
  {
    id: "emerald",
    label: "Esmeralda",
    base: CATEGORY_COLOR_BASE_EMERALD,
    soft: "#D1FAE5",
    border: "#A7F3D0",
    text: "#065F46",
  },
  {
    id: "mint",
    label: "Menta",
    base: CATEGORY_COLOR_BASE_MINT,
    soft: "#CCFBF1",
    border: "#99F6E4",
    text: "#115E59",
  },
  {
    id: "cyan",
    label: "Ciano",
    base: CATEGORY_COLOR_BASE_CYAN,
    soft: "#CFFAFE",
    border: "#A5F3FC",
    text: "#155E75",
  },
  {
    id: "sky",
    label: "Sky",
    base: CATEGORY_COLOR_BASE_SKY,
    soft: "#E0F2FE",
    border: "#BAE6FD",
    text: "#075985",
  },
  {
    id: "slate",
    label: "Slate",
    base: CATEGORY_COLOR_BASE_SLATE,
    soft: "#F1F5F9",
    border: "#CBD5E1",
    text: "#334155",
  },
  {
    id: "zinc",
    label: "Zinc",
    base: CATEGORY_COLOR_BASE_ZINC,
    soft: "#F4F4F5",
    border: "#D4D4D8",
    text: "#3F3F46",
  },
  {
    id: "terra",
    label: "Terra",
    base: CATEGORY_COLOR_BASE_TERRA,
    soft: "#FEF3C7",
    border: "#FDE68A",
    text: "#713F12",
  },
  {
    id: "graphite",
    label: "Grafite",
    base: CATEGORY_COLOR_BASE_GRAPHITE,
    soft: "#E5E7EB",
    border: "#D1D5DB",
    text: "#111827",
  },
] as const satisfies readonly CategoryColorToken[];

export const CATEGORY_COLOR_SETS = [
  {
    id: "blues",
    colors: [
      CATEGORY_COLOR_BASE_SKY,
      CATEGORY_COLOR_BASE_CYAN,
      CATEGORY_COLOR_BASE_BLUE,
      CATEGORY_COLOR_BASE_INDIGO,
      CATEGORY_COLOR_BASE_VIOLET,
    ],
  },
  {
    id: "violets-warm",
    colors: [
      CATEGORY_COLOR_BASE_PURPLE,
      CATEGORY_COLOR_BASE_PINK,
      CATEGORY_COLOR_BASE_ROSE,
      CATEGORY_COLOR_BASE_RED,
      CATEGORY_COLOR_BASE_ORANGE,
    ],
  },
  {
    id: "greens",
    colors: [
      CATEGORY_COLOR_BASE_YELLOW,
      CATEGORY_COLOR_BASE_LIME,
      CATEGORY_COLOR_BASE_GREEN,
      CATEGORY_COLOR_BASE_EMERALD,
      CATEGORY_COLOR_BASE_MINT,
    ],
  },
  {
    id: "neutrals",
    colors: [
      CATEGORY_COLOR_BASE_AMBER,
      CATEGORY_COLOR_BASE_TERRA,
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

export const getNearestCategoryColor = (value: string | undefined | null) => {
  const normalized = normalizeHex(value);
  if (!normalized) return DEFAULT_CATEGORY_COLOR;
  if (CATEGORY_PRESET_COLOR_SET.has(normalized.toLowerCase())) return normalized;

  const target = hexToRgb(normalized);
  if (!target) return DEFAULT_CATEGORY_COLOR;

  let nearest = DEFAULT_CATEGORY_COLOR;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of CATEGORY_PRESET_COLORS) {
    const rgb = hexToRgb(candidate);
    if (!rgb) continue;
    const distance =
      (target.r - rgb.r) ** 2 + (target.g - rgb.g) ** 2 + (target.b - rgb.b) ** 2;
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearest = candidate;
    }
  }

  return nearest;
};

export const getCategoryColorToken = (value: string | undefined | null) => {
  const nearestColor = getNearestCategoryColor(value);
  return (
    CATEGORY_COLOR_TOKEN_BY_BASE.get(nearestColor.toLowerCase()) ??
    CATEGORY_COLOR_TOKEN_BY_BASE.get(DEFAULT_CATEGORY_COLOR.toLowerCase()) ??
    CATEGORY_COLOR_TOKENS[0]
  );
};

export const ONBOARDING_CATEGORY_COLOR_BY_ID: Record<string, string> = {
  "11111111-1111-4111-8111-111111111111": CATEGORY_COLOR_BASE_AMBER,
  "22222222-2222-4222-8222-222222222222": CATEGORY_COLOR_BASE_EMERALD,
  "33333333-3333-4333-8333-333333333333": CATEGORY_COLOR_BASE_ROSE,
};
