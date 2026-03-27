export const CATEGORY_COLOR_BASE_BLUE = "#5B8DEF";
export const CATEGORY_COLOR_BASE_CYAN = "#54B6D9";
export const CATEGORY_COLOR_BASE_GREEN = "#4DBA9A";
export const CATEGORY_COLOR_BASE_LIME = "#8DBD5A";
export const CATEGORY_COLOR_BASE_AMBER = "#E9A23B";
export const CATEGORY_COLOR_BASE_ROSE = "#E57F8E";
export const CATEGORY_COLOR_BASE_VIOLET = "#9B7BEA";

export const CATEGORY_COLOR_SOFT_BLUE = "#8FB2F4";
export const CATEGORY_COLOR_SOFT_CYAN = "#89CDE6";
export const CATEGORY_COLOR_SOFT_GREEN = "#7CCDB6";
export const CATEGORY_COLOR_SOFT_LIME = "#A7CC7D";
export const CATEGORY_COLOR_SOFT_AMBER = "#F1BE6B";
export const CATEGORY_COLOR_SOFT_ROSE = "#E9A3AF";
export const CATEGORY_COLOR_SOFT_VIOLET = "#B59BF0";

export const CATEGORY_COLOR_VIVID_BLUE = "#3F7BF1";
export const CATEGORY_COLOR_VIVID_CYAN = "#26B7D8";
export const CATEGORY_COLOR_VIVID_GREEN = "#22B788";
export const CATEGORY_COLOR_VIVID_LIME = "#75BE3C";
export const CATEGORY_COLOR_VIVID_AMBER = "#F39A1F";
export const CATEGORY_COLOR_VIVID_ROSE = "#E95E79";
export const CATEGORY_COLOR_VIVID_VIOLET = "#875CF2";

export const CATEGORY_COLOR_DEEP_BLUE = "#3569C8";
export const CATEGORY_COLOR_DEEP_CYAN = "#1F8EAF";
export const CATEGORY_COLOR_DEEP_GREEN = "#2F9079";
export const CATEGORY_COLOR_DEEP_LIME = "#5E9336";
export const CATEGORY_COLOR_DEEP_AMBER = "#C47A22";
export const CATEGORY_COLOR_DEEP_ROSE = "#C95E72";
export const CATEGORY_COLOR_DEEP_VIOLET = "#7657C8";

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_BASE_BLUE;

export const CATEGORY_COLOR_SETS = [
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
