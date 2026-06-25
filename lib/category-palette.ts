import type { ThemeMode } from "@/lib/theme-shared";

export type CategoryColorToken = {
  id: string;
  label: string;
  base: string;
  soft: string;
  border: string;
  text: string;
};

export type ResolvedCategoryColorToken = CategoryColorToken & {
  indicator: string;
};

export const CATEGORY_COLOR_SOFT_BLUE = "#93B4E8";
export const CATEGORY_COLOR_SOFT_VIOLET = "#B7A5DD";
export const CATEGORY_COLOR_SOFT_ROSE = "#D9A2B4";
export const CATEGORY_COLOR_SOFT_CORAL = "#DEA08F";
export const CATEGORY_COLOR_SOFT_AMBER = "#D7B56D";
export const CATEGORY_COLOR_SOFT_GREEN = "#91B89D";
export const CATEGORY_COLOR_SOFT_TEAL = "#83B8B4";
export const CATEGORY_COLOR_SOFT_GRAPHITE = "#A9B0BA";

export const CATEGORY_COLOR_DEEP_BLUE = "#446A9E";
export const CATEGORY_COLOR_DEEP_VIOLET = "#6D5A98";
export const CATEGORY_COLOR_DEEP_ROSE = "#9A536B";
export const CATEGORY_COLOR_DEEP_CORAL = "#A85E4C";
export const CATEGORY_COLOR_DEEP_AMBER = "#987335";
export const CATEGORY_COLOR_DEEP_GREEN = "#4E7D5B";
export const CATEGORY_COLOR_DEEP_TEAL = "#407A77";
export const CATEGORY_COLOR_DEEP_GRAPHITE = "#535C68";

// Legacy exports remain unchanged so persisted values and onboarding snapshots
// keep their current storage shape. Rendering maps them to the premium palette.
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

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_SOFT_BLUE;

export const CATEGORY_COLOR_TOKENS = [
  {
    id: "blue-soft",
    label: "Azul suave",
    base: CATEGORY_COLOR_SOFT_BLUE,
    soft: "#EAF1FB",
    border: "#C9D8EF",
    text: "#29476F",
  },
  {
    id: "violet-soft",
    label: "Violeta suave",
    base: CATEGORY_COLOR_SOFT_VIOLET,
    soft: "#F1EDF8",
    border: "#D9CFEA",
    text: "#51416F",
  },
  {
    id: "rose-soft",
    label: "Rosa suave",
    base: CATEGORY_COLOR_SOFT_ROSE,
    soft: "#F8EDF1",
    border: "#E8CBD5",
    text: "#6D3A4B",
  },
  {
    id: "coral-soft",
    label: "Coral suave",
    base: CATEGORY_COLOR_SOFT_CORAL,
    soft: "#FAEEE9",
    border: "#EBCBC1",
    text: "#744137",
  },
  {
    id: "amber-soft",
    label: "Âmbar suave",
    base: CATEGORY_COLOR_SOFT_AMBER,
    soft: "#FAF4E5",
    border: "#E9D8AE",
    text: "#6B5528",
  },
  {
    id: "green-soft",
    label: "Verde suave",
    base: CATEGORY_COLOR_SOFT_GREEN,
    soft: "#ECF5EF",
    border: "#C7DDCE",
    text: "#355C42",
  },
  {
    id: "teal-soft",
    label: "Turquesa suave",
    base: CATEGORY_COLOR_SOFT_TEAL,
    soft: "#EAF5F4",
    border: "#C2DDDA",
    text: "#305D5A",
  },
  {
    id: "graphite-soft",
    label: "Grafite suave",
    base: CATEGORY_COLOR_SOFT_GRAPHITE,
    soft: "#F1F3F5",
    border: "#D5D9DE",
    text: "#414852",
  },
  {
    id: "blue-deep",
    label: "Azul profundo",
    base: CATEGORY_COLOR_DEEP_BLUE,
    soft: "#DCE7F5",
    border: "#AFC4DE",
    text: "#203B60",
  },
  {
    id: "violet-deep",
    label: "Violeta profundo",
    base: CATEGORY_COLOR_DEEP_VIOLET,
    soft: "#E6E0F0",
    border: "#C3B8D9",
    text: "#3E315C",
  },
  {
    id: "rose-deep",
    label: "Rosa profundo",
    base: CATEGORY_COLOR_DEEP_ROSE,
    soft: "#F0DCE3",
    border: "#D7AFC0",
    text: "#5D2D3D",
  },
  {
    id: "coral-deep",
    label: "Coral profundo",
    base: CATEGORY_COLOR_DEEP_CORAL,
    soft: "#F2DDD7",
    border: "#D9AE9F",
    text: "#643326",
  },
  {
    id: "amber-deep",
    label: "Âmbar profundo",
    base: CATEGORY_COLOR_DEEP_AMBER,
    soft: "#F2E7CF",
    border: "#D7C092",
    text: "#5B431D",
  },
  {
    id: "green-deep",
    label: "Verde profundo",
    base: CATEGORY_COLOR_DEEP_GREEN,
    soft: "#DCEADF",
    border: "#B1CCB8",
    text: "#294B32",
  },
  {
    id: "teal-deep",
    label: "Turquesa profundo",
    base: CATEGORY_COLOR_DEEP_TEAL,
    soft: "#D9EAE8",
    border: "#AACBC7",
    text: "#214B49",
  },
  {
    id: "graphite-deep",
    label: "Grafite profundo",
    base: CATEGORY_COLOR_DEEP_GRAPHITE,
    soft: "#E1E4E8",
    border: "#B9BEC6",
    text: "#2D333B",
  },
] as const satisfies readonly CategoryColorToken[];

export const CATEGORY_COLOR_SETS = [
  {
    id: "soft",
    label: "Suaves",
    colors: [
      CATEGORY_COLOR_SOFT_BLUE,
      CATEGORY_COLOR_SOFT_VIOLET,
      CATEGORY_COLOR_SOFT_ROSE,
      CATEGORY_COLOR_SOFT_CORAL,
      CATEGORY_COLOR_SOFT_AMBER,
      CATEGORY_COLOR_SOFT_GREEN,
      CATEGORY_COLOR_SOFT_TEAL,
      CATEGORY_COLOR_SOFT_GRAPHITE,
    ],
  },
  {
    id: "deep",
    label: "Profundas",
    colors: [
      CATEGORY_COLOR_DEEP_BLUE,
      CATEGORY_COLOR_DEEP_VIOLET,
      CATEGORY_COLOR_DEEP_ROSE,
      CATEGORY_COLOR_DEEP_CORAL,
      CATEGORY_COLOR_DEEP_AMBER,
      CATEGORY_COLOR_DEEP_GREEN,
      CATEGORY_COLOR_DEEP_TEAL,
      CATEGORY_COLOR_DEEP_GRAPHITE,
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
  [CATEGORY_COLOR_BASE_BLUE.toLowerCase(), CATEGORY_COLOR_SOFT_BLUE],
  [CATEGORY_COLOR_BASE_SKY.toLowerCase(), CATEGORY_COLOR_SOFT_BLUE],
  [CATEGORY_COLOR_BASE_INDIGO.toLowerCase(), CATEGORY_COLOR_SOFT_VIOLET],
  [CATEGORY_COLOR_BASE_VIOLET.toLowerCase(), CATEGORY_COLOR_SOFT_VIOLET],
  [CATEGORY_COLOR_BASE_PURPLE.toLowerCase(), CATEGORY_COLOR_SOFT_VIOLET],
  [CATEGORY_COLOR_BASE_PINK.toLowerCase(), CATEGORY_COLOR_SOFT_ROSE],
  [CATEGORY_COLOR_BASE_ROSE.toLowerCase(), CATEGORY_COLOR_SOFT_ROSE],
  [CATEGORY_COLOR_BASE_RED.toLowerCase(), CATEGORY_COLOR_SOFT_CORAL],
  [CATEGORY_COLOR_BASE_ORANGE.toLowerCase(), CATEGORY_COLOR_SOFT_CORAL],
  ["#f97316", CATEGORY_COLOR_SOFT_CORAL],
  [CATEGORY_COLOR_BASE_YELLOW.toLowerCase(), CATEGORY_COLOR_SOFT_AMBER],
  [CATEGORY_COLOR_BASE_AMBER.toLowerCase(), CATEGORY_COLOR_SOFT_AMBER],
  [CATEGORY_COLOR_BASE_TERRA.toLowerCase(), CATEGORY_COLOR_SOFT_AMBER],
  [CATEGORY_COLOR_BASE_LIME.toLowerCase(), CATEGORY_COLOR_SOFT_GREEN],
  [CATEGORY_COLOR_BASE_GREEN.toLowerCase(), CATEGORY_COLOR_SOFT_GREEN],
  [CATEGORY_COLOR_BASE_EMERALD.toLowerCase(), CATEGORY_COLOR_SOFT_TEAL],
  [CATEGORY_COLOR_BASE_MINT.toLowerCase(), CATEGORY_COLOR_SOFT_TEAL],
  [CATEGORY_COLOR_BASE_CYAN.toLowerCase(), CATEGORY_COLOR_SOFT_TEAL],
  ["#0f766e", CATEGORY_COLOR_SOFT_TEAL],
  [CATEGORY_COLOR_BASE_SLATE.toLowerCase(), CATEGORY_COLOR_SOFT_GRAPHITE],
  [CATEGORY_COLOR_BASE_ZINC.toLowerCase(), CATEGORY_COLOR_SOFT_GRAPHITE],
  [CATEGORY_COLOR_BASE_GRAPHITE.toLowerCase(), CATEGORY_COLOR_SOFT_GRAPHITE],
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
  const nearestColor = getNearestCategoryColor(value);
  const token =
    CATEGORY_COLOR_TOKEN_BY_BASE.get(nearestColor.toLowerCase()) ??
    CATEGORY_COLOR_TOKEN_BY_BASE.get(DEFAULT_CATEGORY_COLOR.toLowerCase()) ??
    CATEGORY_COLOR_TOKENS[0];

  if (mode === "light") {
    return {
      ...token,
      indicator: token.base,
    };
  }

  const backgroundWeight = token.id.endsWith("-deep") ? 34 : 24;
  return {
    ...token,
    soft: `color-mix(in oklab, ${token.base} ${backgroundWeight}%, #111827)`,
    border: `color-mix(in oklab, ${token.base} 54%, #374151)`,
    text: `color-mix(in oklab, ${token.base} 22%, #F9FAFB)`,
    indicator: `color-mix(in oklab, ${token.base} 72%, #F9FAFB)`,
  };
};

export const ONBOARDING_CATEGORY_COLOR_BY_ID: Record<string, string> = {
  "11111111-1111-4111-8111-111111111111": CATEGORY_COLOR_BASE_AMBER,
  "22222222-2222-4222-8222-222222222222": CATEGORY_COLOR_BASE_EMERALD,
  "33333333-3333-4333-8333-333333333333": CATEGORY_COLOR_BASE_ROSE,
};
