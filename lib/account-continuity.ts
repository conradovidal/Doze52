import type { Habit, HabitCheckIn } from "./types";
import type { GuidedOnboardingState } from "./onboarding";

export type AnnualProgress = {
  origin: "mobile" | "desktop";
  version: number;
  status: "pending" | "in_progress" | "completed" | "dismissed";
  guide?: GuidedOnboardingState;
  firstHabitAt?: string;
  firstCheckInAt?: string;
};
export type ContinuityPayload = Habit | HabitCheckIn | AnnualProgress;
export type ContinuityRecord = {
  kind: "habit" | "checkin" | "onboarding";
  entity_id: string;
  payload: ContinuityPayload;
  revision: number;
  change_seq?: number;
  deleted_at: string | null;
};
export type ContinuityOperation = {
  operationId: string;
  kind: ContinuityRecord["kind"];
  entityId: string;
  payload: ContinuityPayload;
  baseRevision: number;
  delete?: boolean;
  restore?: boolean;
};
export type SyncResult = {
  status: "applied" | "conflict" | "limit";
  record?: ContinuityRecord;
  limit?: number;
};
export type HabitView = {
  habits: Habit[];
  checkIns: Record<string, HabitCheckIn>;
  selectedHabitId: string | null;
  visibleHabitIds: string[];
};
export type ContinuityCache = {
  cursor?: number;
  records: ContinuityRecord[];
  pending: ContinuityOperation[];
  conflicts: ContinuityOperation[];
  preferences: Pick<HabitView, "selectedHabitId" | "visibleHabitIds">;
};
export const emptyContinuityCache = (): ContinuityCache => ({
  records: [],
  pending: [],
  conflicts: [],
  preferences: { selectedHabitId: null, visibleHabitIds: [] },
});
export const recordKey = (
  record: Pick<ContinuityRecord, "kind" | "entity_id">,
) => `${record.kind}:${record.entity_id}`;
export const operationKey = (op: ContinuityOperation) =>
  `${op.kind}:${op.entityId}`;
export const upsertRecord = (
  records: ContinuityRecord[],
  record: ContinuityRecord,
) => [...records.filter((r) => recordKey(r) !== recordKey(record)), record];
export function queueOperation(
  cache: ContinuityCache,
  kind: ContinuityRecord["kind"],
  entityId: string,
  payload: ContinuityPayload,
  deleted = false,
) {
  const previous = cache.records.find(
    (r) => r.kind === kind && r.entity_id === entityId,
  );
  // Never mutate an operation ID: the server binds it to its exact request.
  cache.pending.push({
    operationId: crypto.randomUUID(),
    kind,
    entityId,
    payload,
    baseRevision: previous?.revision ?? 0,
    ...(deleted ? { delete: true } : {}),
  });
}
export function materializeContinuity(cache: ContinuityCache): HabitView {
  let records = cache.records;
  for (const op of cache.pending) {
    if (cache.conflicts.some((c) => operationKey(c) === operationKey(op)))
      continue;
    records = upsertRecord(records, {
      kind: op.kind,
      entity_id: op.entityId,
      payload: op.payload,
      revision: op.baseRevision,
      deleted_at: op.delete ? "pending" : null,
    });
  }
  const habits = records
    .filter((r) => r.kind === "habit" && !r.deleted_at)
    .map((r) => r.payload as Habit);
  const ids = new Set(habits.map((h) => h.id));
  const checkIns = Object.fromEntries(
    records
      .filter(
        (r) =>
          r.kind === "checkin" &&
          !r.deleted_at &&
          ids.has((r.payload as HabitCheckIn).habitId),
      )
      .map((r) => {
        const item = r.payload as HabitCheckIn;
        return [`${item.habitId}:${item.date}`, item];
      }),
  );
  return {
    habits,
    checkIns,
    selectedHabitId: ids.has(cache.preferences.selectedHabitId ?? "")
      ? cache.preferences.selectedHabitId
      : (habits[0]?.id ?? null),
    visibleHabitIds: (cache.preferences.selectedHabitId === null
      ? habits.filter((h) => !h.archivedAt).map((h) => h.id)
      : cache.preferences.visibleHabitIds
    ).filter((id) => ids.has(id)),
  };
}
export function acceptSyncResult(
  cache: ContinuityCache,
  op: ContinuityOperation,
  result: SyncResult,
) {
  if (result.status === "limit") return;
  cache.pending = cache.pending.filter((p) => p.operationId !== op.operationId);
  if (result.record) cache.records = upsertRecord(cache.records, result.record);
  if (result.status === "conflict") {
    cache.conflicts = [
      ...cache.conflicts.filter((p) => operationKey(p) !== operationKey(op)),
      op,
    ];
    // Preserve the latest local intent too; otherwise another queued edit would overwrite the remote conflict.
    const later = cache.pending.filter(
      (p) => operationKey(p) === operationKey(op),
    );
    if (later.length)
      cache.conflicts[cache.conflicts.length - 1] = later[later.length - 1];
    cache.pending = cache.pending.filter(
      (p) => operationKey(p) !== operationKey(op),
    );
  } else {
    cache.pending = cache.pending.map((p) =>
      operationKey(p) === operationKey(op)
        ? { ...p, baseRevision: result.record!.revision }
        : p,
    );
  }
}
export function progressFromCache(
  cache: ContinuityCache,
): AnnualProgress | null {
  const pending = cache.pending.filter((p) => p.kind === "onboarding").at(-1);
  const remote = cache.records.find((r) => r.kind === "onboarding")?.payload as
    AnnualProgress | undefined;
  if (remote?.status === "completed") return remote;
  return pending ? (pending.payload as AnnualProgress) : (remote ?? null);
}
export function importHabitView(
  cache: ContinuityCache,
  view: HabitView,
  activeIds: Set<string>,
) {
  for (const habit of view.habits) {
    if (
      cache.records.some(
        (r) => r.kind === "habit" && r.entity_id === habit.id,
      ) ||
      cache.pending.some((p) => p.kind === "habit" && p.entityId === habit.id)
    )
      continue;
    const imported = {
      ...habit,
      archivedAt: activeIds.has(habit.id)
        ? undefined
        : (habit.archivedAt ?? new Date().toISOString()),
    };
    queueOperation(cache, "habit", habit.id, imported);
  }
  for (const item of Object.values(view.checkIns)) {
    const id = `${item.habitId}:${item.date}`;
    if (
      !cache.records.some((r) => r.kind === "checkin" && r.entity_id === id) &&
      !cache.pending.some((p) => p.kind === "checkin" && p.entityId === id)
    )
      queueOperation(cache, "checkin", id, item);
  }
  cache.preferences.visibleHabitIds = [
    ...new Set([...cache.preferences.visibleHabitIds, ...activeIds]),
  ];
}
