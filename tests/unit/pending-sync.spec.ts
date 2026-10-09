import { test, expect } from "@playwright/test";
import {
  clearPendingSyncSnapshot,
  readPendingSyncSnapshot,
  refreshPendingSyncSnapshot,
  writePendingSyncSnapshot,
} from "../../lib/pending-sync";
import type { CalendarSnapshot } from "../../lib/sync";
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
const event = (id: string): CalendarEvent => ({
  id,
  title: `Evento ${id}`,
  categoryId: "c1",
  color: "#2563eb",
  startDate: "2026-11-14",
  endDate: "2026-11-15",
  createdAt: "2026-02-25T14:27:10.172Z",
  dayOrder: 0,
});
const snapshotWith = (...ids: string[]): CalendarSnapshot => ({
  profiles: [profile],
  categories: [category],
  events: ids.map(event),
});

test.beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  };
});
test.afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

test("edições feitas depois da primeira falha entram no snapshot pendente", () => {
  // Primeira falha de salvamento (sem rede): guarda o estado e a base do servidor.
  writePendingSyncSnapshot("u1", snapshotWith("a"), "server-key-1");
  // A pessoa continua editando offline: o store local ganha o evento "b".
  refreshPendingSyncSnapshot("u1", snapshotWith("a", "b"));

  const pending = readPendingSyncSnapshot("u1");
  expect(pending?.snapshot.events.map((item) => item.id)).toEqual(["a", "b"]);
  // A base continua sendo o servidor do momento da falha, senão o retry não
  // saberia dizer se outro aparelho mexeu no calendário.
  expect(pending?.baseKey).toBe("server-key-1");
});

test("sem snapshot pendente a atualização não cria um", () => {
  refreshPendingSyncSnapshot("u1", snapshotWith("a"));
  expect(readPendingSyncSnapshot("u1")).toBeNull();
});

test("o snapshot pendente é por conta e some quando limpo", () => {
  writePendingSyncSnapshot("u1", snapshotWith("a"), "k1");
  writePendingSyncSnapshot("u2", snapshotWith("z"), "k2");
  refreshPendingSyncSnapshot("u1", snapshotWith("a", "b"));

  expect(readPendingSyncSnapshot("u2")?.snapshot.events.map((item) => item.id)).toEqual(["z"]);
  clearPendingSyncSnapshot("u1");
  expect(readPendingSyncSnapshot("u1")).toBeNull();
  expect(readPendingSyncSnapshot("u2")).not.toBeNull();
});
