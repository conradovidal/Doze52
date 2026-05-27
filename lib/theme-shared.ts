export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "doze52-theme";
export const THEME_ASSET_VERSION = "20260527a";

export const THEME_FAVICON_URLS: Record<ThemeMode, string> = {
  light: `/doze52-favicon-light.svg?v=${THEME_ASSET_VERSION}`,
  dark: `/doze52-favicon-dark.svg?v=${THEME_ASSET_VERSION}`,
};

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark";
