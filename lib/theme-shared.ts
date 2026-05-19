export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "doze52-theme";

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark";
