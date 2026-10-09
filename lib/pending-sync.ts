import type { CalendarSnapshot } from "./sync";
import { ensureSnapshotCoverage } from "./snapshot-ownership";

const PENDING_SYNC_STORAGE_PREFIX = "pending-sync:";

type PendingSyncPayload = {
  savedAt: string;
  snapshot: CalendarSnapshot;
  // Content key of the server state this snapshot was based on. Without it the
  // snapshot cannot be told apart from a stale one and is never replayed.
  baseKey?: string;
};

const cloneSnapshot = (snapshot: CalendarSnapshot): CalendarSnapshot => ({
  profiles: snapshot.profiles.map((profile) => ({ ...profile })),
  categories: snapshot.categories.map((category) => ({ ...category })),
  events: snapshot.events.map((event) => ({ ...event })),
});

const getPendingSyncStorageKey = (userId: string) =>
  `${PENDING_SYNC_STORAGE_PREFIX}${userId}`;

const isCalendarSnapshotLike = (value: unknown): value is CalendarSnapshot => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  return (
    Array.isArray(record.profiles) &&
    Array.isArray(record.categories) &&
    Array.isArray(record.events)
  );
};

export const readPendingSyncSnapshot = (
  userId: string
): { snapshot: CalendarSnapshot; baseKey?: string } | null => {
  if (typeof window === "undefined") return null;

  const key = getPendingSyncStorageKey(userId);

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    const payload = parsed as Partial<PendingSyncPayload>;
    const snapshot = payload?.snapshot ?? parsed;

    if (!isCalendarSnapshotLike(snapshot)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      snapshot: ensureSnapshotCoverage(snapshot),
      baseKey: typeof payload?.baseKey === "string" ? payload.baseKey : undefined,
    };
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
};

export const writePendingSyncSnapshot = (
  userId: string,
  snapshot: CalendarSnapshot,
  baseKey?: string
) => {
  if (typeof window === "undefined") return;

  const payload: PendingSyncPayload = {
    savedAt: new Date().toISOString(),
    snapshot: cloneSnapshot(snapshot),
    baseKey,
  };

  window.localStorage.setItem(
    getPendingSyncStorageKey(userId),
    JSON.stringify(payload)
  );
};

// Edits made while a save is blocked (typically offline) only live in the
// local store. The pending snapshot is what the next retry replays, so it has
// to follow them: otherwise the retry — or a reload — brings back the version
// from the moment the save first failed and the later edits are lost. The
// original `baseKey` is kept: it still names the server state the edits sit on.
export const refreshPendingSyncSnapshot = (
  userId: string,
  snapshot: CalendarSnapshot
) => {
  const pending = readPendingSyncSnapshot(userId);
  if (!pending) return;
  writePendingSyncSnapshot(userId, snapshot, pending.baseKey);
};

export const clearPendingSyncSnapshot = (userId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getPendingSyncStorageKey(userId));
};
