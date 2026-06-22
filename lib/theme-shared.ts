export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "doze52-theme";
export const THEME_ASSET_VERSION = "20260619d";
export const FAVICON_LIGHT_URL = `/doze52-favicon-light.svg?v=${THEME_ASSET_VERSION}`;
export const FAVICON_DARK_URL = `/doze52-favicon-dark.svg?v=${THEME_ASSET_VERSION}`;
export const FAVICON_URL = FAVICON_LIGHT_URL;

export const getThemeFaviconUrl = (mode: ThemeMode) =>
  mode === "dark" ? FAVICON_DARK_URL : FAVICON_LIGHT_URL;

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark";
