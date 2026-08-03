import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { calendarPacks } from "../lib/calendar-packs";
import {
  getCalendarPackGroupId,
  isRecognizedLegacyPackEvent,
  isStrictSemanticPackEvent,
  reconcileInstalledCalendarPacks,
} from "../lib/calendar-packs/import";
import type { CalendarSnapshot } from "../lib/sync";
import type { CalendarPack } from "../lib/calendar-packs/types";
import type { CalendarEvent, CalendarProfile, CategoryItem } from "../lib/types";

const apply = process.argv.includes("--apply");
const runIdArgument = process.argv.find((argument) =>
  argument.startsWith("--run-id=")
);
const runId = runIdArgument?.split("=")[1] || randomUUID();
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fetchAll = async <T>(table: string): Promise<T[]> => {
  const pageSize = 1_000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < pageSize) return rows;
  }
};

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const main = async () => {
const profiles = await fetchAll<Record<string, unknown>>("calendar_profiles");
const categories = await fetchAll<Record<string, unknown>>("categories");
const events = await fetchAll<Record<string, unknown>>("events");
const userIds = new Set<string>([
  ...profiles.map((row) => String(row.user_id)),
  ...categories.map((row) => String(row.user_id)),
  ...events.map((row) => String(row.user_id)),
]);

const toSnapshot = (userId: string): CalendarSnapshot => {
  const userProfiles: CalendarProfile[] = profiles
    .filter((row) => row.user_id === userId)
    .map((row) => ({
      id: String(row.id),
      userId,
      name: String(row.name),
      color: String(row.color),
      icon: (row.icon || "calendar-days") as CalendarProfile["icon"],
      position: Number(row.position) || 0,
    }));
  const userCategories: CategoryItem[] = categories
    .filter((row) => row.user_id === userId)
    .map((row) => ({
      id: String(row.id),
      userId,
      profileId: String(row.profile_id),
      name: String(row.name),
      color: String(row.color),
      visible: Boolean(row.visible),
      calendarPackGroupId: row.calendar_pack_group_id
        ? String(row.calendar_pack_group_id)
        : undefined,
      calendarPackVariantId: row.calendar_pack_variant_id
        ? String(row.calendar_pack_variant_id)
        : undefined,
      calendarPackCategoryKey: row.calendar_pack_category_key
        ? String(row.calendar_pack_category_key)
        : undefined,
      calendarPackVersion: row.calendar_pack_version
        ? Number(row.calendar_pack_version)
        : undefined,
    }));
  const colorByCategoryId = new Map(
    userCategories.map((category) => [category.id, category.color])
  );
  const userEvents: CalendarEvent[] = events
    .filter((row) => row.user_id === userId)
    .map((row) => ({
      id: String(row.id),
      userId,
      title: String(row.title),
      categoryId: String(row.category_id),
      color: colorByCategoryId.get(String(row.category_id)) ?? "#2563EB",
      startDate: String(row.start_date),
      endDate: String(row.end_date),
      notes: row.notes ? String(row.notes) : undefined,
      recurrenceType: row.recurrence_type
        ? (String(row.recurrence_type) as CalendarEvent["recurrenceType"])
        : undefined,
      recurrenceUntil: row.recurrence_until
        ? String(row.recurrence_until)
        : undefined,
      createdAt: String(row.created_at),
      dayOrder: Number(row.day_order) || 0,
      calendarPackGroupId: row.calendar_pack_group_id
        ? String(row.calendar_pack_group_id)
        : undefined,
      calendarPackEventKey: row.calendar_pack_event_key
        ? String(row.calendar_pack_event_key)
        : undefined,
    }));
  return {
    profiles: userProfiles,
    categories: userCategories,
    events: userEvents,
  };
};

const toRows = (userId: string, snapshot: CalendarSnapshot) => ({
  profiles: snapshot.profiles.map((profile, position) => ({
    id: profile.id,
    user_id: userId,
    name: profile.name,
    color: profile.color,
    icon: profile.icon,
    position,
  })),
  categories: snapshot.categories.map((category, position) => ({
    id: category.id,
    user_id: userId,
    profile_id: category.profileId,
    name: category.name,
    color: category.color,
    visible: category.visible,
    calendar_pack_group_id: category.calendarPackGroupId ?? null,
    calendar_pack_variant_id: category.calendarPackVariantId ?? null,
    calendar_pack_category_key: category.calendarPackCategoryKey ?? null,
    calendar_pack_version: category.calendarPackVersion ?? null,
    position,
  })),
  events: snapshot.events.map((event) => ({
    id: event.id,
    user_id: userId,
    title: event.title,
    category_id: event.categoryId,
    start_date: event.startDate,
    end_date: event.endDate,
    notes: event.notes ?? null,
    recurrence_type: event.recurrenceType ?? null,
    recurrence_until: event.recurrenceUntil ?? null,
    day_order: event.dayOrder,
    created_at: event.createdAt,
    calendar_pack_group_id: event.calendarPackGroupId ?? null,
    calendar_pack_event_key: event.calendarPackEventKey ?? null,
  })),
});

let candidateAccounts = 0;
let repairedAccounts = 0;
let ambiguousAccounts = 0;

for (const userId of userIds) {
  const before = toSnapshot(userId);
  const semanticMatches = new Map<string, Set<string>>();
  for (const event of before.events) {
    for (const pack of calendarPacks) {
      if (
        pack.events.some((packEvent) =>
          isStrictSemanticPackEvent(event, packEvent, pack)
        )
      ) {
        const matches = semanticMatches.get(event.id) ?? new Set<string>();
        matches.add(getCalendarPackGroupId(pack));
        semanticMatches.set(event.id, matches);
      }
    }
  }
  let ambiguousEventCount = [...semanticMatches.values()].filter(
    (matches) => matches.size > 1
  ).length;
  const packsByGroup = new Map<string, CalendarPack[]>();
  for (const pack of calendarPacks) {
    const groupId = getCalendarPackGroupId(pack);
    packsByGroup.set(groupId, [...(packsByGroup.get(groupId) ?? []), pack]);
  }
  for (const variants of packsByGroup.values()) {
    if (variants.length < 2) continue;
    const evidenceCounts = variants
      .map((pack) => ({
        count: before.events.filter(
          (event) =>
            isRecognizedLegacyPackEvent(event, pack) ||
            pack.events.some((packEvent) =>
              isStrictSemanticPackEvent(event, packEvent, pack)
            )
        ).length,
        id: pack.id,
      }))
      .sort((left, right) => right.count - left.count);
    if (
      evidenceCounts[0]?.count > 0 &&
      evidenceCounts[0].count === evidenceCounts[1]?.count
    ) {
      ambiguousEventCount += evidenceCounts[0].count;
    }
  }
  if (ambiguousEventCount > 0) {
    ambiguousAccounts += 1;
    console.log(JSON.stringify({ status: "ambiguous", ambiguousEventCount }));
    continue;
  }

  const result = reconcileInstalledCalendarPacks(before, calendarPacks);
  if (result.updatedPackCount === 0) continue;
  candidateAccounts += 1;
  const after = result.snapshot;
  const beforeHash = hash(before);
  const afterHash = hash(after);
  const summary = {
    updatedPackCount: result.updatedPackCount,
    categoryDelta: after.categories.length - before.categories.length,
    eventDelta: after.events.length - before.events.length,
  };
  console.log(JSON.stringify({ status: apply ? "applying" : "dry-run", ...summary }));
  if (!apply) continue;

  const rows = toRows(userId, after);
  const { error } = await supabase.rpc("repair_calendar_snapshot", {
    p_run_id: runId,
    p_user_id: userId,
    p_profiles: rows.profiles,
    p_categories: rows.categories,
    p_events: rows.events,
    p_before_hash: beforeHash,
    p_after_hash: afterHash,
    p_result: summary,
  });
  if (error) throw error;
  repairedAccounts += 1;
}

console.log(
  JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    runId,
    scannedAccounts: userIds.size,
    candidateAccounts,
    repairedAccounts,
    ambiguousAccounts,
  })
);
};

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : "Calendar repair failed.";
  console.error(message);
  process.exitCode = 1;
});
