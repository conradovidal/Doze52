"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { trackContinuityMetric } from "./product-metrics";
import { useHabitsStore } from "./habits-store";
import { getSupabaseBrowserClient } from "./supabase";
import { isAccountContinuityEnabled } from "./feature-flags";
import {
  GUIDED_ONBOARDING_CHANGE_EVENT,
  GUIDED_ONBOARDING_STORAGE_KEY,
  readGuidedOnboardingState,
  type GuidedOnboardingState,
} from "./onboarding";
import {
  acceptSyncResult,
  emptyContinuityCache,
  importHabitView,
  materializeContinuity,
  progressFromCache,
  queueOperation,
  upsertRecord,
  type AnnualProgress,
  type ContinuityCache,
  type ContinuityRecord,
  type HabitView,
  type SyncResult,
} from "./account-continuity";

const draftKey = "doze52:continuity:current-draft";
const claimKey = (draft: string) =>
  draft === "anonymous"
    ? "doze52:continuity:anonymous-owner"
    : `doze52:continuity:draft-owner:${draft}`;
const importedKey = (draft: string, userId: string) =>
  `doze52:continuity:imported:${draft}:${userId}`;
const key = (owner: string) => `doze52:continuity:v1:${owner}`;
function readCache(owner: string): ContinuityCache {
  try {
    const raw = localStorage.getItem(key(owner));
    return raw ? JSON.parse(raw) : emptyContinuityCache();
  } catch {
    return emptyContinuityCache();
  }
}
function legacyView(): HabitView | null {
  try {
    const view = JSON.parse(
      localStorage.getItem("doze52:habits-store:v1") ?? "null",
    )?.state;
    return view?.habits?.length ? view : null;
  } catch {
    return null;
  }
}
export function restoreGuide(guide: GuidedOnboardingState) {
  localStorage.setItem(GUIDED_ONBOARDING_STORAGE_KEY, JSON.stringify(guide));
  window.dispatchEvent(
    new CustomEvent(GUIDED_ONBOARDING_CHANGE_EVENT, { detail: guide }),
  );
}
export function useAccountContinuity(
  userId: string | undefined,
  authLoading: boolean,
  isMobile: boolean | null,
) {
  const [version, refresh] = useState(0);
  const [status, setStatus] = useState<
    "local" | "loading" | "saving" | "saved" | "pending" | "unavailable"
  >("loading");
  useEffect(() => {
    if (!isAccountContinuityEnabled || !userId) return;
    if (status === "saved") trackContinuityMetric("sync_confirmed");
    if (status === "pending" || status === "unavailable")
      trackContinuityMetric("sync_failed");
  }, [status, userId]);
  const [ready, setReady] = useState(false);
  const [legacy, setLegacy] = useState<HabitView | null>(null);
  const [importSource, setImportSource] = useState<"legacy" | "anonymous">(
    "legacy",
  );
  const [accountLimit, setAccountLimit] = useState(1);
  const [limit, setLimit] = useState<number | null>(null);
  const cacheRef = useRef<ContinuityCache>(emptyContinuityCache());
  const ownerRef = useRef("");
  const importDraftRef = useRef("anonymous");
  const applying = useRef(false);
  const generation = useRef(0);
  const replaying = useRef(false);
  const flushRef = useRef<() => void>(() => {});
  const update = useCallback(() => {
    localStorage.setItem(
      key(ownerRef.current),
      JSON.stringify(cacheRef.current),
    );
    refresh((v) => v + 1);
  }, []);
  const render = useCallback(() => {
    applying.current = true;
    const view = materializeContinuity(cacheRef.current);
    useHabitsStore.setState(view);
    applying.current = false;
    update();
  }, [update]);
  const setProgress = useCallback(
    (progress: AnnualProgress) => {
      if (!ownerRef.current) return;
      if (
        progressFromCache(cacheRef.current)?.status === "completed" &&
        progress.status !== "completed"
      )
        return;
      queueOperation(cacheRef.current, "onboarding", "annual", progress);
      update();
      flushRef.current();
    },
    [update],
  );

  useEffect(() => {
    if (!isAccountContinuityEnabled || authLoading || isMobile === null) return;
    const runId = ++generation.current;
    let draft = localStorage.getItem(draftKey) ?? "anonymous";
    if (!userId && localStorage.getItem(claimKey(draft))) {
      draft = `anonymous-${crypto.randomUUID()}`;
      localStorage.setItem(draftKey, draft);
    }
    importDraftRef.current = draft;
    const owner = userId ?? draft;
    ownerRef.current = owner;
    replaying.current = false;
    cacheRef.current = readCache(owner);
    setReady(false);
    setLegacy(null);
    setLimit(null);
    setStatus(userId ? "loading" : "local");
    render();
    let disposed = false;
    let busy = false;
    let requested = false;
    let initialized = false;
    let initializing = false;
    const current = () => !disposed && generation.current === runId;
    let unsubscribe = () => {};
    const publishProgress = () => {
      const progress = progressFromCache(cacheRef.current);
      if (userId && progress && !replaying.current) {
        applying.current = true;
        restoreGuide(
          progress.guide ?? { version: 15, step: "context_selection" },
        );
        applying.current = false;
      }
    };
    const pull = async () => {
      const cache = cacheRef.current;
      while (current()) {
        const { data, error } = await getSupabaseBrowserClient().rpc(
          "pull_continuity_changes",
          { after_sequence: cache.cursor ?? 0 },
        );
        if (!current()) return;
        if (error) throw error;
        const records = data as ContinuityRecord[];
        for (const record of records)
          cache.records = upsertRecord(cache.records, record);
        cache.cursor = records.at(-1)?.change_seq ?? cache.cursor ?? 0;
        update();
        if (records.length < 500) break;
      }
    };
    const flush = async () => {
      if (!current()) return;
      if (!userId) {
        // Anonymous drafts use exactly the same durable record representation without a remote acknowledgment.
        const cache = cacheRef.current;
        for (const op of [...cache.pending])
          acceptSyncResult(cache, op, {
            status: "applied",
            record: {
              kind: op.kind,
              entity_id: op.entityId,
              payload: op.payload,
              revision: op.baseRevision + 1,
              deleted_at: op.delete ? new Date().toISOString() : null,
            },
          });
        update();
        return;
      }
      if (busy) {
        requested = true;
        return;
      }
      busy = true;
      try {
        const db = getSupabaseBrowserClient();
        const cache = cacheRef.current;
        if (cache.pending.length) setStatus("saving");
        while (cache.pending.length && current()) {
          const op = cache.pending[0];
          const { data, error } = await db.rpc("apply_continuity_operation", {
            op,
          });
          if (!current()) return;
          if (error?.code === "23503" && op.kind === "checkin") {
            acceptSyncResult(cache, op, { status: "conflict" });
            update();
            continue;
          }
          if (error) throw error;
          const result = data as SyncResult;
          if (result.status === "limit") {
            setLimit(result.limit ?? 1);
            setStatus("pending");
            return;
          }
          acceptSyncResult(cache, op, result);
          update();
        }
        await pull();
        if (!current()) return;
        render();
        publishProgress();
        setStatus(cache.conflicts.length ? "pending" : "saved");
      } catch {
        if (current()) setStatus("pending");
      } finally {
        busy = false;
        if (requested && current()) {
          requested = false;
          void flush();
        }
      }
    };
    flushRef.current = () => {
      void flush();
    };
    const initialize = async () => {
      if (initializing || initialized || !current()) return;
      initializing = true;
      if (userId) {
        try {
          const db = getSupabaseBrowserClient();
          const contract = await db.rpc("continuity_contract_version");
          if (!current()) return;
          if (contract.error || contract.data !== 2) {
            setStatus("unavailable");
            initializing = false;
            return;
          }
          await pull();
          if (!current()) return;
          const limitResponse = await db.rpc("continuity_habit_limit");
          if (!current()) return;
          if (limitResponse.error) throw limitResponse.error;
          const maxHabits = Number(limitResponse.data);
          setAccountLimit(maxHabits);
          const anon = readCache(draft);
          const anonView = materializeContinuity(anon);
          const claimed = localStorage.getItem(claimKey(draft));
          if (!claimed && anonView.habits.length) {
            // Claim first so switching accounts while sync is pending cannot import this draft twice.
            localStorage.setItem(claimKey(draft), userId);
            const existing = materializeContinuity(cacheRef.current);
            if (
              existing.habits.filter((h) => !h.archivedAt).length +
                anonView.habits.filter((h) => !h.archivedAt).length <=
              maxHabits
            ) {
              importHabitView(
                cacheRef.current,
                anonView,
                new Set(
                  [...existing.habits, ...anonView.habits]
                    .filter((h) => !h.archivedAt)
                    .map((h) => h.id),
                ),
              );
              update();
              localStorage.setItem(importedKey(draft, userId), "true");
            } else {
              setImportSource("anonymous");
              setLegacy(anonView);
            }
          } else if (
            claimed === userId &&
            !localStorage.getItem(importedKey(draft, userId)) &&
            anonView.habits.length
          ) {
            setImportSource("anonymous");
            setLegacy(anonView);
          } else if (!localStorage.getItem("doze52:continuity:legacy-owner")) {
            setImportSource("legacy");
            setLegacy(legacyView());
          }
          if (!progressFromCache(cacheRef.current)) {
            const localGuide = readGuidedOnboardingState();
            const progress =
              !claimed || claimed === userId
                ? (progressFromCache(anon) ??
                  (draft === "anonymous" && localGuide.step === "completed"
                    ? {
                        origin: isMobile
                          ? ("mobile" as const)
                          : ("desktop" as const),
                        version: 1,
                        status: "completed" as const,
                        guide: localGuide,
                      }
                    : null))
                : null;
            queueOperation(
              cacheRef.current,
              "onboarding",
              "annual",
              progress ?? {
                origin: isMobile ? "mobile" : "desktop",
                version: 1,
                status: "pending",
              },
            );
          }
          render();
          publishProgress();
        } catch {
          if (current()) setStatus("pending");
          initializing = false;
          return;
        }
      } else if (!progressFromCache(cacheRef.current)) {
        const guide =
          draft === "anonymous"
            ? readGuidedOnboardingState()
            : ({
                version: 15,
                step: "context_selection",
              } as GuidedOnboardingState);
        const status = guide.step === "completed" ? "completed" : "pending";
        queueOperation(cacheRef.current, "onboarding", "annual", {
          origin: isMobile ? "mobile" : "desktop",
          version: 1,
          status,
          ...(status === "completed" ? { guide } : {}),
        });
      }
      if (!current()) return;
      if (!userId) publishProgress();
      unsubscribe = useHabitsStore.subscribe((state, previous) => {
        if (applying.current || !current()) return;
        const cache = cacheRef.current;
        cache.preferences = {
          selectedHabitId: state.selectedHabitId,
          visibleHabitIds: state.visibleHabitIds,
        };
        for (const habit of state.habits)
          if (
            JSON.stringify(habit) !==
            JSON.stringify(previous.habits.find((h) => h.id === habit.id))
          )
            queueOperation(cache, "habit", habit.id, habit);
        for (const habit of previous.habits)
          if (!state.habits.some((h) => h.id === habit.id))
            queueOperation(cache, "habit", habit.id, habit, true);
        for (const item of Object.values(state.checkIns))
          if (
            JSON.stringify(item) !==
            JSON.stringify(previous.checkIns[`${item.habitId}:${item.date}`])
          )
            queueOperation(
              cache,
              "checkin",
              `${item.habitId}:${item.date}`,
              item,
            );
        const progress = progressFromCache(cache);
        if (
          progress &&
          ((!progress.firstHabitAt && state.habits.length) ||
            (!progress.firstCheckInAt &&
              Object.values(state.checkIns).some((c) => c.completed)))
        ) {
          queueOperation(cache, "onboarding", "annual", {
            ...progress,
            firstHabitAt:
              progress.firstHabitAt ??
              (state.habits.length ? new Date().toISOString() : undefined),
            firstCheckInAt:
              progress.firstCheckInAt ??
              (Object.values(state.checkIns).some((c) => c.completed)
                ? new Date().toISOString()
                : undefined),
          });
        }
        update();
        void flush();
      });
      initializing = false;
      initialized = true;
      if (userId) trackContinuityMetric("authenticated");
      setReady(true);
      void flush();
    };
    const onGuide = (event: Event) => {
      if (applying.current || !current()) return;
      const guide = (event as CustomEvent<GuidedOnboardingState>).detail;
      const previous = progressFromCache(cacheRef.current);
      if (!guide || !previous) return;
      if (guide.step === "context_selection" && previous.status === "dismissed")
        return;
      if (replaying.current) {
        if (guide.step === "completed" || guide.step.startsWith("dismissed"))
          replaying.current = false;
        return;
      }
      const status =
        guide.step === "completed"
          ? "completed"
          : guide.step.startsWith("dismissed") ||
              guide.step === "demo_exploration"
            ? "dismissed"
            : guide.step === "context_selection"
              ? previous.status === "in_progress"
                ? "in_progress"
                : "pending"
              : "in_progress";
      if (status !== previous.status) {
        if (status === "in_progress") trackContinuityMetric("annual_started");
        if (status === "completed") trackContinuityMetric("annual_completed");
      }
      setProgress({ ...previous, guide, status });
    };
    const trigger = () => {
      if (initialized) void flush();
      else void initialize();
    };
    flushRef.current = trigger;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (!initialized) void initialize();
        else void flush();
      }
    };
    void initialize();
    window.addEventListener(GUIDED_ONBOARDING_CHANGE_EVENT, onGuide);
    window.addEventListener("online", trigger);
    window.addEventListener("focus", trigger);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") trigger();
    }, 30000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener(GUIDED_ONBOARDING_CHANGE_EVENT, onGuide);
      window.removeEventListener("online", trigger);
      window.removeEventListener("focus", trigger);
      document.removeEventListener("visibilitychange", onVisible);
      flushRef.current = () => {};
    };
    // viewport changes must not reset account subscriptions or replace a draft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authLoading, isMobile === null, render, update, setProgress]);

  const importDraft = (activeIds: string[]) => {
    if (!legacy || !userId) return;
    if (importSource === "legacy")
      localStorage.setItem("doze52:continuity:legacy-owner", userId);
    // Archive remote excess before inserting incoming active habits.
    const existing = materializeContinuity(cacheRef.current);
    const timestamp = new Date().toISOString();
    for (const habit of existing.habits) {
      if (!activeIds.includes(habit.id) && !habit.archivedAt)
        queueOperation(cacheRef.current, "habit", habit.id, {
          ...habit,
          archivedAt: timestamp,
        });
    }
    for (const habit of existing.habits) {
      if (activeIds.includes(habit.id) && habit.archivedAt)
        queueOperation(cacheRef.current, "habit", habit.id, {
          ...habit,
          archivedAt: undefined,
        });
    }
    importHabitView(cacheRef.current, legacy, new Set(activeIds));
    update();
    localStorage.setItem(importedKey(importDraftRef.current, userId), "true");
    setLegacy(null);
    render();
    flushRef.current();
  };
  const reapply = (operationId: string) => {
    const cache = cacheRef.current;
    const op = cache.conflicts.find((o) => o.operationId === operationId);
    if (!op) return;
    const remote = cache.records.find(
      (r) => r.kind === op.kind && r.entity_id === op.entityId,
    );
    if (op.kind === "checkin") {
      const parent = cache.records.find(
        (r) =>
          r.kind === "habit" &&
          r.entity_id === (op.payload as { habitId: string }).habitId,
      );
      if (parent?.deleted_at)
        cache.pending.push({
          operationId: crypto.randomUUID(),
          kind: "habit",
          entityId: parent.entity_id,
          payload: parent.payload,
          baseRevision: parent.revision,
          restore: true,
        });
    }
    cache.pending.push({
      ...op,
      operationId: crypto.randomUUID(),
      baseRevision: remote?.revision ?? 0,
      ...(remote?.deleted_at ? { restore: true } : {}),
    });
    cache.conflicts = cache.conflicts.filter(
      (o) => o.operationId !== operationId,
    );
    render();
    flushRef.current();
  };
  const archivePending = () => {
    cacheRef.current.pending = cacheRef.current.pending.map((op) =>
      op.kind === "habit" && !op.delete
        ? {
            ...op,
            operationId: crypto.randomUUID(),
            payload: { ...op.payload, archivedAt: new Date().toISOString() },
          }
        : op,
    );
    setLimit(null);
    render();
    flushRef.current();
  };
  void version;
  return {
    beginReplay: () => {
      replaying.current =
        progressFromCache(cacheRef.current)?.status === "completed";
    },
    accountLimit,
    importCandidates: legacy
      ? [
          ...materializeContinuity(cacheRef.current).habits,
          ...legacy.habits.filter(
            (h) =>
              !materializeContinuity(cacheRef.current).habits.some(
                (r) => r.id === h.id,
              ),
          ),
        ]
      : [],
    enabled: isAccountContinuityEnabled,
    ready:
      !isAccountContinuityEnabled ||
      (ready &&
        ownerRef.current ===
          (userId ??
            (typeof window !== "undefined"
              ? (localStorage.getItem(draftKey) ?? "anonymous")
              : "anonymous"))),
    status,
    progress: progressFromCache(cacheRef.current),
    setProgress,
    legacy,
    importSource,
    importDraft,
    dismissImport: () => setLegacy(null),
    conflicts: cacheRef.current.conflicts,
    reapply,
    discardConflict: (id: string) => {
      cacheRef.current.conflicts = cacheRef.current.conflicts.filter(
        (o) => o.operationId !== id,
      );
      render();
    },
    limit,
    archivePending,
    retry: () => flushRef.current(),
  };
}
