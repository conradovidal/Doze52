export const CATEGORY_COLOR_BASE_BLUE = "#5B8DEF";
export const CATEGORY_COLOR_BASE_GREEN = "#4DBA9A";
export const CATEGORY_COLOR_BASE_AMBER = "#E9A23B";
export const CATEGORY_COLOR_BASE_ROSE = "#E57F8E";
export const CATEGORY_COLOR_BASE_VIOLET = "#9B7BEA";
export const CATEGORY_COLOR_BASE_OLIVE = "#8DBD5A";

export const CATEGORY_COLOR_SOFT_BLUE = "#8FB2F4";
export const CATEGORY_COLOR_SOFT_GREEN = "#7CCDB6";
export const CATEGORY_COLOR_SOFT_AMBER = "#F1BE6B";
export const CATEGORY_COLOR_SOFT_ROSE = "#E9A3AF";
export const CATEGORY_COLOR_SOFT_VIOLET = "#B59BF0";
export const CATEGORY_COLOR_SOFT_OLIVE = "#A7CC7D";

export const CATEGORY_COLOR_DEEP_BLUE = "#3569C8";
export const CATEGORY_COLOR_DEEP_GREEN = "#2F9079";
export const CATEGORY_COLOR_DEEP_AMBER = "#C47A22";
export const CATEGORY_COLOR_DEEP_ROSE = "#C95E72";
export const CATEGORY_COLOR_DEEP_VIOLET = "#7657C8";
export const CATEGORY_COLOR_DEEP_OLIVE = "#5E9336";

export const CATEGORY_COLOR_EARTH_SAND = "#B79B7A";
export const CATEGORY_COLOR_EARTH_TERRACOTTA = "#A46C54";
export const CATEGORY_COLOR_EARTH_TAUPE = "#8C7A58";
export const CATEGORY_COLOR_EARTH_TEAL = "#6E9D8D";
export const CATEGORY_COLOR_EARTH_SLATE = "#7D879A";
export const CATEGORY_COLOR_EARTH_MAUVE = "#85748F";

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_BASE_BLUE;

export const CATEGORY_COLOR_SETS = [
  {
    id: "base",
    label: "Base",
    colors: [
      CATEGORY_COLOR_BASE_BLUE,
      CATEGORY_COLOR_BASE_GREEN,
      CATEGORY_COLOR_BASE_AMBER,
      CATEGORY_COLOR_BASE_ROSE,
      CATEGORY_COLOR_BASE_VIOLET,
      CATEGORY_COLOR_BASE_OLIVE,
    ],
  },
  {
    id: "soft",
    label: "Suaves",
    colors: [
      CATEGORY_COLOR_SOFT_BLUE,
      CATEGORY_COLOR_SOFT_GREEN,
      CATEGORY_COLOR_SOFT_AMBER,
      CATEGORY_COLOR_SOFT_ROSE,
      CATEGORY_COLOR_SOFT_VIOLET,
      CATEGORY_COLOR_SOFT_OLIVE,
    ],
  },
  {
    id: "deep",
    label: "Profundas",
    colors: [
      CATEGORY_COLOR_DEEP_BLUE,
      CATEGORY_COLOR_DEEP_GREEN,
      CATEGORY_COLOR_DEEP_AMBER,
      CATEGORY_COLOR_DEEP_ROSE,
      CATEGORY_COLOR_DEEP_VIOLET,
      CATEGORY_COLOR_DEEP_OLIVE,
    ],
  },
  {
    id: "earth",
    label: "Terrosas",
    colors: [
      CATEGORY_COLOR_EARTH_SAND,
      CATEGORY_COLOR_EARTH_TERRACOTTA,
      CATEGORY_COLOR_EARTH_TAUPE,
      CATEGORY_COLOR_EARTH_TEAL,
      CATEGORY_COLOR_EARTH_SLATE,
      CATEGORY_COLOR_EARTH_MAUVE,
    ],
  },
] as const;

export const CATEGORY_PRESET_COLORS = CATEGORY_COLOR_SETS.flatMap((set) => set.colors);

const CATEGORY_PRESET_COLOR_SET = new Set(
  CATEGORY_PRESET_COLORS.map((color) => color.toLowerCase())
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

export const ONBOARDING_CATEGORY_COLOR_BY_ID: Record<string, string> = {
  "11111111-1111-4111-8111-111111111111": CATEGORY_COLOR_BASE_AMBER,
  "22222222-2222-4222-8222-222222222222": CATEGORY_COLOR_BASE_GREEN,
  "33333333-3333-4333-8333-333333333333": CATEGORY_COLOR_BASE_BLUE,
};

export const PREVIOUS_ONBOARDING_COLOR_BY_ID: Record<string, string> = {
  "11111111-1111-4111-8111-111111111111": "#f59e0b",
  "22222222-2222-4222-8222-222222222222": "#16a34a",
  "33333333-3333-4333-8333-333333333333": "#2563eb",
};
