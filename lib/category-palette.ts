export const CATEGORY_COLOR_BASE_BLUE = "#5B8DEF";
export const CATEGORY_COLOR_BASE_CYAN = "#4DB7D4";
export const CATEGORY_COLOR_BASE_GREEN = "#42B78A";
export const CATEGORY_COLOR_BASE_LIME = "#8ABD45";
export const CATEGORY_COLOR_BASE_AMBER = "#E9A23B";
export const CATEGORY_COLOR_BASE_ROSE = "#E57F8E";
export const CATEGORY_COLOR_BASE_VIOLET = "#9B7BEA";

export const CATEGORY_COLOR_SOFT_BLUE = "#A7C2FA";
export const CATEGORY_COLOR_SOFT_CYAN = "#9AD9EA";
export const CATEGORY_COLOR_SOFT_GREEN = "#9ADABF";
export const CATEGORY_COLOR_SOFT_LIME = "#B9D98D";
export const CATEGORY_COLOR_SOFT_AMBER = "#F6C97C";
export const CATEGORY_COLOR_SOFT_ROSE = "#EDB4BF";
export const CATEGORY_COLOR_SOFT_VIOLET = "#C6AFF4";

export const CATEGORY_COLOR_VIVID_BLUE = "#2F6FF1";
export const CATEGORY_COLOR_VIVID_CYAN = "#0FA7D1";
export const CATEGORY_COLOR_VIVID_GREEN = "#10A86F";
export const CATEGORY_COLOR_VIVID_LIME = "#6AAD1F";
export const CATEGORY_COLOR_VIVID_AMBER = "#F1900F";
export const CATEGORY_COLOR_VIVID_ROSE = "#E45272";
export const CATEGORY_COLOR_VIVID_VIOLET = "#7A4FE8";

export const CATEGORY_COLOR_DEEP_BLUE = "#2B58B8";
export const CATEGORY_COLOR_DEEP_CYAN = "#157E9D";
export const CATEGORY_COLOR_DEEP_GREEN = "#257B61";
export const CATEGORY_COLOR_DEEP_LIME = "#4E7C22";
export const CATEGORY_COLOR_DEEP_AMBER = "#B96C14";
export const CATEGORY_COLOR_DEEP_ROSE = "#C14C67";
export const CATEGORY_COLOR_DEEP_VIOLET = "#6445B8";

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_BASE_BLUE;

export const CATEGORY_COLOR_SETS = [
  {
    id: "soft",
    colors: [
      CATEGORY_COLOR_SOFT_BLUE,
      CATEGORY_COLOR_SOFT_CYAN,
      CATEGORY_COLOR_SOFT_GREEN,
      CATEGORY_COLOR_SOFT_LIME,
      CATEGORY_COLOR_SOFT_AMBER,
      CATEGORY_COLOR_SOFT_ROSE,
      CATEGORY_COLOR_SOFT_VIOLET,
    ],
  },
  {
    id: "base",
    colors: [
      CATEGORY_COLOR_BASE_BLUE,
      CATEGORY_COLOR_BASE_CYAN,
      CATEGORY_COLOR_BASE_GREEN,
      CATEGORY_COLOR_BASE_LIME,
      CATEGORY_COLOR_BASE_AMBER,
      CATEGORY_COLOR_BASE_ROSE,
      CATEGORY_COLOR_BASE_VIOLET,
    ],
  },
  {
    id: "vivid",
    colors: [
      CATEGORY_COLOR_VIVID_BLUE,
      CATEGORY_COLOR_VIVID_CYAN,
      CATEGORY_COLOR_VIVID_GREEN,
      CATEGORY_COLOR_VIVID_LIME,
      CATEGORY_COLOR_VIVID_AMBER,
      CATEGORY_COLOR_VIVID_ROSE,
      CATEGORY_COLOR_VIVID_VIOLET,
    ],
  },
  {
    id: "deep",
    colors: [
      CATEGORY_COLOR_DEEP_BLUE,
      CATEGORY_COLOR_DEEP_CYAN,
      CATEGORY_COLOR_DEEP_GREEN,
      CATEGORY_COLOR_DEEP_LIME,
      CATEGORY_COLOR_DEEP_AMBER,
      CATEGORY_COLOR_DEEP_ROSE,
      CATEGORY_COLOR_DEEP_VIOLET,
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
