export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "doze52-theme";
export const THEME_ASSET_VERSION = "20260625a";
export const FAVICON_LIGHT_URL = `/doze52-favicon-light.svg?v=${THEME_ASSET_VERSION}`;
export const FAVICON_DARK_URL = `/doze52-favicon-dark.svg?v=${THEME_ASSET_VERSION}`;
export const FAVICON_URL = FAVICON_LIGHT_URL;
export const THEME_CHROME_COLOR_LIGHT = "#ffffff";
export const THEME_CHROME_COLOR_DARK = "#171717";
export const THEME_CHROME_COLOR_FALLBACK = THEME_CHROME_COLOR_LIGHT;

export const getThemeFaviconUrl = (mode: ThemeMode) =>
  mode === "dark" ? FAVICON_DARK_URL : FAVICON_LIGHT_URL;

export const getThemeChromeColor = (mode: ThemeMode) =>
  mode === "dark" ? THEME_CHROME_COLOR_DARK : THEME_CHROME_COLOR_LIGHT;

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark";
