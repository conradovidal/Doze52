import type { CalendarCatalog } from "./types";

export const isCalendarCatalog = (value: unknown): value is CalendarCatalog => {
  if (!value || typeof value !== "object") return false;
  const catalog = value as Partial<CalendarCatalog>;
  return (
    catalog.schemaVersion === 1 &&
    typeof catalog.version === "number" &&
    typeof catalog.materialHash === "string" &&
    Array.isArray(catalog.packs) &&
    catalog.packs.every(
      (pack) =>
        pack &&
        typeof pack.id === "string" &&
        Number.isInteger(pack.version) &&
        Array.isArray(pack.events)
    )
  );
};
