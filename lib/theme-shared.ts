export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "doze52-theme";
export const THEME_ASSET_VERSION = "20260528d";
export const FAVICON_URL = `/icon.svg?v=${THEME_ASSET_VERSION}`;

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark";
