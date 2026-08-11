import { createHash } from "node:crypto";
import type { CalendarPack, CalendarPackEvent } from "@/lib/calendar-packs/types";
import type { CatalogDiff } from "./types";

const omitVerification = (key: string, value: unknown) =>
  key === "lastVerified" ? undefined : value;

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "lastVerified")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
};

export const materialJson = (value: unknown) =>
  JSON.stringify(stableValue(value), omitVerification);

export const materialHash = (value: unknown) =>
  createHash("sha256").update(materialJson(value)).digest("hex");

const eventMap = (packs: readonly CalendarPack[]) =>
  new Map(
    packs.flatMap((pack) =>
      pack.events.map((event) => [`${pack.id}:${event.id}`, event] as const)
    )
  );

export const diffCatalogs = (
  previous: readonly CalendarPack[],
  candidate: readonly CalendarPack[]
): CatalogDiff => {
  const before = eventMap(previous);
  const after = eventMap(candidate);
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const [id, event] of after) {
    const previousEvent = before.get(id);
    if (!previousEvent) added.push(id);
    else if (materialJson(previousEvent) !== materialJson(event)) changed.push(id);
  }
  for (const id of before.keys()) if (!after.has(id)) removed.push(id);

  return { added, changed, removed };
};

export const incrementChangedPackVersions = (
  previous: readonly CalendarPack[],
  candidate: readonly CalendarPack[]
) => {
  const previousById = new Map(previous.map((pack) => [pack.id, pack]));
  return candidate.map((pack) => {
    const oldPack = previousById.get(pack.id);
    if (!oldPack) return { ...pack, version: Math.max(1, pack.version) };
    const oldMaterial = { ...oldPack, version: 0 };
    const newMaterial = { ...pack, version: 0 };
    return {
      ...pack,
      version:
        materialJson(oldMaterial) === materialJson(newMaterial)
          ? oldPack.version
          : oldPack.version + 1,
    };
  });
};

export const eventMaterialFingerprint = (event: CalendarPackEvent) =>
  materialHash(event);
