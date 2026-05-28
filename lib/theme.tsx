"use client";

import * as React from "react";
import {
  THEME_STORAGE_KEY,
  type ThemeMode,
  isThemeMode,
} from "@/lib/theme-shared";

type ThemeContextValue = {
  mode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const getSystemTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const readStoredTheme = (): ThemeMode | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : null;
  } catch {
    return null;
  }
};

const persistTheme = (mode: ThemeMode) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore persistence errors (private mode, disabled storage, etc).
  }
};

const applyThemeToDocument = (mode: ThemeMode) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
};

const resolveInitialTheme = (): ThemeMode => {
  if (typeof document !== "undefined") {
    if (document.documentElement.classList.contains("dark")) return "dark";
  }
  return readStoredTheme() ?? getSystemTheme();
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<ThemeMode>(resolveInitialTheme);

  React.useEffect(() => {
    applyThemeToDocument(mode);
  }, [mode]);

  React.useEffect(() => {
    const stored = readStoredTheme();
    if (stored) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithSystem = () => {
      setMode(media.matches ? "dark" : "light");
    };

    media.addEventListener("change", syncWithSystem);
    return () => media.removeEventListener("change", syncWithSystem);
  }, []);

  const setTheme = React.useCallback((nextMode: ThemeMode) => {
    persistTheme(nextMode);
    setMode(nextMode);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(mode === "light" ? "dark" : "light");
  }, [mode, setTheme]);

  const value = React.useMemo(
    () => ({
      mode,
      setTheme,
      toggleTheme,
    }),
    [mode, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
};
