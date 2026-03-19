const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type Rgb = {
  r: number;
  g: number;
  b: number;
};

const parseHexToRgb = (hex: string): Rgb => {
  const normalized = hex.trim().replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return { r: 59, g: 130, b: 246 };
  }

  const int = Number.parseInt(expanded, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const rgbToHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb => ({
  r: from.r + (to.r - from.r) * amount,
  g: from.g + (to.g - from.g) * amount,
  b: from.b + (to.b - from.b) * amount,
});

const toRelativeLuminance = ({ r, g, b }: Rgb) => {
  const normalize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const rs = normalize(r);
  const gs = normalize(g);
  const bs = normalize(b);
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const getContrastRatio = (a: Rgb, b: Rgb) => {
  const lighter = Math.max(toRelativeLuminance(a), toRelativeLuminance(b));
  const darker = Math.min(toRelativeLuminance(a), toRelativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
};

const pickForeground = (background: Rgb) => {
  const dark = { r: 24, g: 24, b: 27 };
  const light = { r: 250, g: 250, b: 250 };
  return getContrastRatio(background, dark) >= getContrastRatio(background, light)
    ? rgbToHex(dark)
    : rgbToHex(light);
};

export const deriveEventBarStyle = (color: string) => {
  const source = parseHexToRgb(color);
  const backgroundRgb = mixRgb(source, { r: 255, g: 255, b: 255 }, 0.68);
  const borderRgb = mixRgb(source, { r: 255, g: 255, b: 255 }, 0.48);
  const markerRgb = mixRgb(source, { r: 255, g: 255, b: 255 }, 0.1);

  return {
    backgroundColor: rgbToHex(backgroundRgb),
    borderColor: rgbToHex(borderRgb),
    markerColor: rgbToHex(markerRgb),
    foregroundColor: pickForeground(backgroundRgb),
  };
};
