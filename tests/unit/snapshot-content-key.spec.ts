import { test, expect } from "@playwright/test";
import {
  isPendingSnapshotCurrent,
  snapshotContentKey,
} from "../../lib/snapshot-content-key";
import type { CalendarEvent, CalendarProfile, CategoryItem } from "../../lib/types";

const profile: CalendarProfile = {
  id: "p1",
  name: "Pessoal",
  color: "#64748B",
  icon: "user",
  position: 0,
};
const category: CategoryItem = {
  id: "c1",
  profileId: "p1",
  name: "Natação",
  color: "#2563eb",
  visible: true,
};
const event = (id: string, patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  title: `Evento ${id}`,
  categoryId: "c1",
  color: "#2563eb",
  startDate: "2026-11-14",
  endDate: "2026-11-15",
  createdAt: "2026-02-25T14:27:10.172Z",
  dayOrder: 0,
  ...patch,
});
const snapshot = (events: CalendarEvent[]) => ({
  profiles: [profile],
  categories: [category],
  events,
});

test("a snapshot read back from the server matches the one that was saved", () => {
  const saved = snapshot([event("e1", { userId: undefined, notes: "  " })]);
  const readBack = snapshot([
    event("e1", {
      userId: "user-1",
      notes: undefined,
      color: "#000000",
      createdAt: "2026-09-19T20:30:39.026Z",
    }),
  ]);
  expect(snapshotContentKey(readBack)).toBe(snapshotContentKey(saved));
});

test("event order does not matter, but a missing or edited event does", () => {
  const a = event("a");
  const b = event("b");
  expect(snapshotContentKey(snapshot([a, b]))).toBe(
    snapshotContentKey(snapshot([b, a]))
  );
  expect(snapshotContentKey(snapshot([a]))).not.toBe(
    snapshotContentKey(snapshot([a, b]))
  );
  expect(snapshotContentKey(snapshot([a]))).not.toBe(
    snapshotContentKey(snapshot([event("a", { title: "Outro" })]))
  );
  expect(snapshotContentKey(snapshot([a]))).not.toBe(
    snapshotContentKey(snapshot([event("a", { endDate: "2026-11-16" })]))
  );
});

test("category order is content, since it is persisted as position", () => {
  const other: CategoryItem = { ...category, id: "c2", name: "Corrida" };
  const one = { ...snapshot([]), categories: [category, other] };
  const two = { ...snapshot([]), categories: [other, category] };
  expect(snapshotContentKey(one)).not.toBe(snapshotContentKey(two));
});

test("a pending snapshot is replayed only while the server is unchanged", () => {
  const before = snapshot([event("a"), event("b")]);
  const baseKey = snapshotContentKey(before);

  // Server still as this device last saw it: safe to replay.
  expect(isPendingSnapshotCurrent(baseKey, before)).toBe(true);

  // Another device deleted "b" meanwhile: replaying would resurrect it.
  expect(isPendingSnapshotCurrent(baseKey, snapshot([event("a")]))).toBe(false);

  // Payloads saved before baseKey existed cannot be verified.
  expect(isPendingSnapshotCurrent(undefined, before)).toBe(false);
});
