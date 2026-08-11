"use client";

import * as React from "react";
import { calendarPacks as staticCalendarPacks } from "@/lib/calendar-packs";
import type { CalendarPack } from "@/lib/calendar-packs/types";
import { isCalendarCatalog } from "./catalog-shape";
import type { CalendarCatalog } from "./types";

const STORAGE_KEY = "doze52:calendar-catalog:last-valid:v1";

type RuntimeCatalog = {
  calendarPacks: readonly CalendarPack[];
  catalog: CalendarCatalog | null;
  source: "static" | "cache" | "remote";
  refresh: () => Promise<void>;
};

const Context = React.createContext<RuntimeCatalog>({
  calendarPacks: staticCalendarPacks,
  catalog: null,
  source: "static",
  refresh: async () => {},
});

export function CalendarCatalogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Omit<RuntimeCatalog, "refresh">>({
    calendarPacks: staticCalendarPacks, catalog: null, source: "static",
  });
  const etagRef = React.useRef<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch("/api/calendar-packs", {
        headers: etagRef.current ? { "If-None-Match": etagRef.current } : {},
      });
      if (response.status === 304) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value: unknown = await response.json();
      if (!isCalendarCatalog(value)) throw new Error("Catálogo inválido");
      etagRef.current = response.headers.get("etag");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      setState({ calendarPacks: value.packs, catalog: value, source: "remote" });
    } catch {
      // The last valid catalog or the compiled fallback stays active.
    }
  }, []);

  React.useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const value: unknown = JSON.parse(cached);
        if (isCalendarCatalog(value)) {
          setState({ calendarPacks: value.packs, catalog: value, source: "cache" });
        }
      } catch { /* ignore invalid local cache */ }
    }
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return <Context.Provider value={{ ...state, refresh }}>{children}</Context.Provider>;
}

export const useCalendarCatalog = () => React.useContext(Context);
