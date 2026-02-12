import type { CalendarEvent, CategoryItem } from "@/lib/types";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase";
import { logDevError, logProdError } from "@/lib/safe-log";
import {
  ValidationError,
  validateCategoryInput,
  validateEventInput,
} from "@/lib/validation";

type DbCategory = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  visible: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

type DbEvent = {
  id: string;
  user_id: string;
  title: string;
  category_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  day_order: Record<string, number>;
};

export type CalendarSnapshot = {
  categories: CategoryItem[];
  events: CalendarEvent[];
};

let saveInFlight: Promise<void> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("status 5") ||
    normalized.includes("503") ||
    normalized.includes("502") ||
    normalized.includes("500")
  );
};

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === retries || !isTransientError(message)) break;
      await sleep(attempt === 0 ? 300 : 800);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha de sincronizacao.");
}

const toLocalCategory = (row: DbCategory): CategoryItem => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  color: row.color,
  visible: row.visible,
});

const toLocalEvent = (row: DbEvent, categories: CategoryItem[]): CalendarEvent => ({
  id: row.id,
  title: row.title,
  userId: row.user_id,
  categoryId: row.category_id,
  color:
    categories.find((c) => c.id === row.category_id)?.color ??
    "#2563eb",
  startDate: row.start_date,
  endDate: row.end_date,
  createdAt: row.created_at,
  dayOrder: row.day_order ?? {},
});

const todayIso = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const ensureRowId = (id: string | undefined) =>
  id && id.trim() ? id : crypto.randomUUID();

const validateSnapshot = (snapshot: CalendarSnapshot) => {
  const categoryIds = new Set<string>();
  for (const category of snapshot.categories) {
    validateCategoryInput(category);
    categoryIds.add(category.id);
  }
  for (const event of snapshot.events) {
    validateEventInput(event, categoryIds);
  }
};

const ensureSupabase = () => {
  if (!hasSupabaseEnv) {
    throw new Error(
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return getSupabaseBrowserClient();
};

const getCurrentUserIdOrThrow = async () => {
  const supabase = ensureSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) {
    throw new Error("Sessao expirada. Faca login novamente.");
  }
  return userId;
};

export const fetchCategories = async (): Promise<CategoryItem[]> => {
  const supabase = ensureSupabase();
  const userId = await getCurrentUserIdOrThrow();
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as DbCategory[]).map(toLocalCategory);
  });
};

export const fetchEvents = async (
  categories: CategoryItem[]
): Promise<CalendarEvent[]> => {
  const supabase = ensureSupabase();
  const userId = await getCurrentUserIdOrThrow();
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as DbEvent[]).map((row) => toLocalEvent(row, categories));
  });
};

export const loadRemoteData = async (): Promise<CalendarSnapshot> => {
  try {
    const categories = await fetchCategories();
    const events = await fetchEvents(categories);
    return { categories, events };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao carregar dados remotos.";
    logDevError("sync.loadRemoteData", { message });
    logProdError("Falha ao carregar dados remotos.");
    throw error;
  }
};

export const saveSnapshot = async (snapshot: CalendarSnapshot): Promise<void> => {
  if (saveInFlight) return saveInFlight;
  saveInFlight = saveSnapshotInternal(snapshot).finally(() => {
    saveInFlight = null;
  });
  return saveInFlight;
};

const saveSnapshotInternal = async (snapshot: CalendarSnapshot): Promise<void> => {
  const supabase = ensureSupabase();
  const userId = await getCurrentUserIdOrThrow();

  try {
    validateSnapshot(snapshot);

    await withRetry(async () => {
      const categoryRows = snapshot.categories.map((category, index) => ({
        id: ensureRowId(category.id),
        user_id: userId,
        name: category.name.trim(),
        color: category.color,
        visible: category.visible,
        position: index,
      }));

      const eventRows = snapshot.events.map((event) => ({
        id: ensureRowId(event.id),
        user_id: userId,
        title: event.title.trim(),
        category_id: event.categoryId,
        start_date: event.startDate || todayIso(),
        end_date: event.endDate || event.startDate || todayIso(),
        day_order: event.dayOrder ?? {},
        created_at: event.createdAt || nowIso(),
      }));

      const [currentCategories, currentEvents] = await Promise.all([
        supabase.from("categories").select("id").eq("user_id", userId),
        supabase.from("events").select("id").eq("user_id", userId),
      ]);

      if (currentCategories.error) throw currentCategories.error;
      if (currentEvents.error) throw currentEvents.error;

      if (categoryRows.length > 0) {
        const { error } = await supabase
          .from("categories")
          .upsert(categoryRows, { onConflict: "id" });
        if (error) throw error;
      }

      if (eventRows.length > 0) {
        const { error } = await supabase
          .from("events")
          .upsert(eventRows, { onConflict: "id" });
        if (error) throw error;
      }

      const localCategoryIds = new Set(categoryRows.map((row) => row.id));
      const remoteCategoryIds = ((currentCategories.data ?? []) as { id: string }[]).map(
        (row) => row.id
      );
      const categoriesToDelete = remoteCategoryIds.filter((id) => !localCategoryIds.has(id));
      if (categoriesToDelete.length > 0) {
        const { error } = await supabase
          .from("categories")
          .delete()
          .eq("user_id", userId)
          .in("id", categoriesToDelete);
        if (error) throw error;
      }

      const localEventIds = new Set(eventRows.map((row) => row.id));
      const remoteEventIds = ((currentEvents.data ?? []) as { id: string }[]).map(
        (row) => row.id
      );
      const eventsToDelete = remoteEventIds.filter((id) => !localEventIds.has(id));
      if (eventsToDelete.length > 0) {
        const { error } = await supabase
          .from("events")
          .delete()
          .eq("user_id", userId)
          .in("id", eventsToDelete);
        if (error) throw error;
      }
    }, 1);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Falhou ao salvar. Tente novamente.";
    logDevError("sync.saveSnapshot", { message, userId });
    logProdError("Falha ao salvar dados do usuario.");
    throw new Error("Falhou ao salvar. Tente novamente.");
  }
};

const escapeCsv = (value: unknown) => {
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
};

const toCsv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const head = headers.join(",");
  const body = rows
    .map((row) => headers.map((header) => escapeCsv(row[header])).join(","))
    .join("\n");
  return `${head}\n${body}`;
};

const downloadFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportUserData = async () => {
  const snapshot = await loadRemoteData();
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(
    `doze52-data-${stamp}.json`,
    JSON.stringify(snapshot, null, 2),
    "application/json"
  );

  const categoriesCsv = toCsv(
    snapshot.categories.map((category, index) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      visible: category.visible,
      position: index,
    }))
  );
  downloadFile(
    `doze52-categories-${stamp}.csv`,
    categoriesCsv,
    "text/csv;charset=utf-8"
  );

  const eventsCsv = toCsv(
    snapshot.events.map((event) => ({
      id: event.id,
      title: event.title,
      category_id: event.categoryId,
      start_date: event.startDate,
      end_date: event.endDate,
      created_at: event.createdAt,
      day_order: event.dayOrder,
    }))
  );
  downloadFile(`doze52-events-${stamp}.csv`, eventsCsv, "text/csv;charset=utf-8");
};
