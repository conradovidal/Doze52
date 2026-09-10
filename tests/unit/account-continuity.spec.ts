import { withoutOnboardingExamples } from "../../lib/snapshot-ownership";
import { getOnboardingContextSeedSnapshot } from "../../lib/store";
import { test, expect } from "@playwright/test";
import {
  acceptSyncResult,
  emptyContinuityCache,
  importHabitView,
  materializeContinuity,
  progressFromCache,
  queueOperation,
} from "../../lib/account-continuity";
import type { Habit } from "../../lib/types";
const habit: Habit = {
  id: "h1",
  name: "Ler",
  color: "#123456",
  icon: "circle-check",
  position: 0,
  createdAt: "2026-09-07",
  updatedAt: "2026-09-07",
};
test("pending edits survive a pull and unchecks remain explicit", () => {
  const c = emptyContinuityCache();
  queueOperation(c, "habit", "h1", habit);
  queueOperation(c, "checkin", "h1:2026-09-07", {
    habitId: "h1",
    date: "2026-09-07",
    completed: false,
    updatedAt: "2026-09-07",
  });
  expect(materializeContinuity(c).habits).toHaveLength(1);
  expect(materializeContinuity(c).checkIns["h1:2026-09-07"].completed).toBe(
    false,
  );
});
test("conflict shows remote and preserves latest local edit for explicit reapply", () => {
  const c = emptyContinuityCache();
  queueOperation(c, "habit", "h1", habit);
  const first = c.pending[0];
  queueOperation(c, "habit", "h1", { ...habit, name: "Local latest" });
  acceptSyncResult(c, first, {
    status: "conflict",
    record: {
      kind: "habit",
      entity_id: "h1",
      payload: { ...habit, name: "Remote" },
      revision: 3,
      deleted_at: null,
    },
  });
  expect(materializeContinuity(c).habits[0].name).toBe("Remote");
  expect(c.conflicts[0].payload).toMatchObject({ name: "Local latest" });
  expect(c.pending).toHaveLength(0);
});
test("acknowledgment rebases only subsequent operations on same record", () => {
  const c = emptyContinuityCache();
  queueOperation(c, "habit", "h1", habit);
  const first = c.pending[0];
  queueOperation(c, "habit", "h1", { ...habit, name: "Later" });
  acceptSyncResult(c, first, {
    status: "applied",
    record: {
      kind: "habit",
      entity_id: "h1",
      payload: habit,
      revision: 4,
      deleted_at: null,
    },
  });
  expect(c.pending[0].baseRevision).toBe(4);
  expect(c.pending[0].operationId).not.toBe(first.operationId);
});
test("imports preserve IDs, archive excess and are idempotent including checkins", () => {
  const c = emptyContinuityCache();
  const view = {
    habits: [habit],
    checkIns: {},
    visibleHabitIds: ["h1"],
    selectedHabitId: "h1",
  };
  importHabitView(c, view, new Set());
  importHabitView(c, view, new Set());
  expect(c.pending).toHaveLength(1);
  expect(materializeContinuity(c).habits[0].archivedAt).toBeTruthy();
});
test("confirmed completion beats a stale local draft", () => {
  const c = emptyContinuityCache();
  c.records = [
    {
      kind: "onboarding",
      entity_id: "annual",
      payload: { origin: "mobile", version: 1, status: "completed" },
      revision: 2,
      deleted_at: null,
    },
  ];
  queueOperation(c, "onboarding", "annual", {
    origin: "desktop",
    version: 1,
    status: "pending",
  });
  expect(progressFromCache(c)?.status).toBe("completed");
});
test("tombstones suppress old habits and their checkins", () => {
  const c = emptyContinuityCache();
  c.records = [
    {
      kind: "habit",
      entity_id: "h1",
      payload: habit,
      revision: 2,
      deleted_at: "2026-09-07",
    },
  ];
  expect(materializeContinuity(c).habits).toHaveLength(0);
});

test("example categories never consume account limits or remove a chosen calendar", async () => {
  const demo = getOnboardingContextSeedSnapshot(2026, "personal");
  const real = {
    ...demo.categories[0],
    id: "real",
    calendarPackGroupId: undefined,
  };
  const chosen = {
    ...demo.categories[0],
    id: "chosen",
    calendarPackGroupId: "calendar-chosen-by-user",
  };
  const result = withoutOnboardingExamples({
    ...demo,
    categories: [...demo.categories, real, chosen],
  });
  expect(result.categories.map((c) => c.id)).toEqual(["real", "chosen"]);
  expect(result.events).toEqual([]);
  expect(result.profiles).toEqual(demo.profiles);
});
