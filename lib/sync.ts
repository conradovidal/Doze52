import type { CalendarEvent, CategoryItem } from "@/lib/types";
import {
  getSupabaseBrowserClient,
  hasSupabaseEnv,
  supabaseEnv,
} from "@/lib/supabase";
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
  notes: string | null;
  created_at: string;
  updated_at: string;
  day_order: unknown;
};

export type CalendarSnapshot = {
  categories: CategoryItem[];
  events: CalendarEvent[];
};

export type SyncErrorKind =
  | "missing_relation"
  | "permission"
  | "not_authenticated"
  | "network"
  | "environment"
  | "unknown";

export class SyncError extends Error {
  kind: SyncErrorKind;
  userMessage: string;
  retryable: boolean;

  constructor(kind: SyncErrorKind, userMessage: string, retryable = false) {
    super(userMessage);
    this.kind = kind;
    this.userMessage = userMessage;
    this.retryable = retryable;
    this.name = "SyncError";
  }
}

let saveInFlight: Promise<void> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const genericSyncMessage = "Falha de sincronizacao. Tente novamente.";

type QueryAction = "select" | "insert/update" | "delete" | "getUser";
type QueryMeta = {
  table: "categories" | "events" | "auth";
  action: QueryAction;
};

const isDetailedSyncErrorEnabled = () =>
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_APP_ENV === "local" ||
  process.env.NEXT_PUBLIC_APP_ENV === "dev";

const getSupabaseOrigin = () => {
  try {
    return new URL(supabaseEnv.url).origin;
  } catch {
    return "invalid-supabase-url";
  }
};

const getErrorStatus = (error: unknown) => {
  if (typeof error === "object" && error && "status" in error) {
    const status = Number((error as { status?: number }).status);
    return Number.isFinite(status) ? status : undefined;
  }
  return undefined;
};

const getErrorCode = (error: unknown) => {
  if (typeof error === "object" && error && "code" in error) {
    return String((error as { code?: string }).code);
  }
  return undefined;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

const getErrorBody = (error: unknown) => {
  if (typeof error !== "object" || !error) {
    return { message: String(error ?? "unknown") };
  }
  const record = error as Record<string, unknown>;
  return {
    code: record.code ?? null,
    message: record.message ?? null,
    details: record.details ?? null,
    hint: record.hint ?? null,
  };
};

const logQueryFailure = (meta: QueryMeta, error: unknown) => {
  if (!isDetailedSyncErrorEnabled()) return;
  console.error("[sync.supabase.error]", {
    supabaseUrl: getSupabaseOrigin(),
    table: meta.table,
    action: meta.action,
    status: getErrorStatus(error) ?? null,
    responseBody: getErrorBody(error),
  });
};

const assertQuerySuccess = (error: unknown, meta: QueryMeta) => {
  if (!error) return;
  logQueryFailure(meta, error);
  throw error;
};

const safeSupabaseMessage = (message: string) => {
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (
    /token|apikey|api_key|authorization|bearer|service_role|anon_key/i.test(
      trimmed
    )
  ) {
    return null;
  }
  return trimmed.length > 220 ? `${trimmed.slice(0, 217)}...` : trimmed;
};

const logSanitizedField = (params: {
  table: "categories" | "events";
  action: "insert/update";
  field: string;
  original: unknown;
  sanitized: number | null;
}) => {
  if (!isDetailedSyncErrorEnabled()) return;
  console.warn("[sync.sanitize]", {
    supabaseUrl: getSupabaseOrigin(),
    table: params.table,
    action: params.action,
    field: params.field,
    original: params.original,
    sanitized: params.sanitized,
  });
};

const sanitizeIntegerField = (params: {
  table: "categories" | "events";
  action: "insert/update";
  field: string;
  value: unknown;
  fallback?: number | null;
}): number | null => {
  const fallback = params.fallback ?? 0;
  let next: number | null;

  if (typeof params.value === "number" && Number.isFinite(params.value)) {
    next = Math.trunc(params.value);
  } else if (
    typeof params.value === "string" &&
    params.value.trim().length > 0 &&
    Number.isFinite(Number(params.value))
  ) {
    next = Math.trunc(Number(params.value));
  } else {
    next = fallback;
    logSanitizedField({
      table: params.table,
      action: params.action,
      field: params.field,
      original: params.value,
      sanitized: next,
    });
  }

  return next;
};

const normalizeDayOrderFromDb = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(Number(value))
  ) {
    return Math.max(0, Math.trunc(Number(value)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidates = Object.values(value)
      .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
      .map((entry) => Math.trunc(entry))
      .filter((entry) => entry >= 0);
    if (candidates.length > 0) {
      return Math.min(...candidates);
    }
  }
  return 0;
};

const userMessageForKind = (kind: SyncErrorKind, fallbackMessage?: string) => {
  if (!isDetailedSyncErrorEnabled()) return genericSyncMessage;
  if (kind === "not_authenticated") return "Nao autenticado.";
  if (kind === "permission") return "Sem permissao (RLS).";
  if (kind === "missing_relation") return "Tabela nao existe neste ambiente.";
  if (kind === "network") return "Falha de rede.";
  if (kind === "environment") return "Ambiente Supabase incorreto ou nao configurado.";
  return safeSupabaseMessage(fallbackMessage ?? "") ?? genericSyncMessage;
};

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

const isMissingRelationError = (message: string, code?: string, status?: number) => {
  const normalized = message.toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    status === 404 ||
    normalized.includes("does not exist") ||
    normalized.includes("relation") ||
    normalized.includes("schema cache")
  );
};

const isPermissionError = (message: string, code?: string, status?: number) => {
  const normalized = message.toLowerCase();
  return (
    status === 403 ||
    code === "42501" ||
    normalized.includes("permission denied") ||
    normalized.includes("row-level security") ||
    normalized.includes("not authorized")
  );
};

const isNotAuthenticatedError = (
  message: string,
  code?: string,
  status?: number
) => {
  const normalized = message.toLowerCase();
  return (
    status === 401 ||
    code === "PGRST301" ||
    normalized.includes("nao autenticado") ||
    normalized.includes("sessao expirada") ||
    normalized.includes("jwt") ||
    normalized.includes("auth session missing")
  );
};

const classifySyncError = (error: unknown): SyncError => {
  if (error instanceof SyncError) return error;
  if (error instanceof ValidationError) {
    return new SyncError(
      "unknown",
      userMessageForKind("unknown", error.message),
      false
    );
  }
  const message = getErrorMessage(error);
  const status = getErrorStatus(error);
  const code = getErrorCode(error);

  if (message.toLowerCase().includes("supabase nao configurado")) {
    return new SyncError(
      "environment",
      userMessageForKind("environment"),
      false
    );
  }
  if (isNotAuthenticatedError(message, code, status)) {
    return new SyncError(
      "not_authenticated",
      userMessageForKind("not_authenticated"),
      false
    );
  }
  if (isMissingRelationError(message, code, status)) {
    return new SyncError(
      "missing_relation",
      userMessageForKind("missing_relation"),
      false
    );
  }
  if (isPermissionError(message, code, status)) {
    return new SyncError(
      "permission",
      userMessageForKind("permission"),
      false
    );
  }
  if (isTransientError(message)) {
    return new SyncError(
      "network",
      userMessageForKind("network"),
      true
    );
  }
  return new SyncError("unknown", userMessageForKind("unknown", message), false);
};

async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const classified = classifySyncError(error);
      if (attempt === retries || !classified.retryable) break;
      await sleep(attempt === 0 ? 300 : 800);
    }
  }
  throw classifySyncError(lastError);
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
  notes: row.notes ?? undefined,
  createdAt: row.created_at,
  dayOrder: normalizeDayOrderFromDb(row.day_order),
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
  assertQuerySuccess(error, {
    table: "auth",
    action: "getUser",
  });
  const userId = data.user?.id;
  if (!userId) {
    const authError = new Error("Nao autenticado.");
    logQueryFailure(
      {
        table: "auth",
        action: "getUser",
      },
      authError
    );
    throw authError;
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
    assertQuerySuccess(error, { table: "categories", action: "select" });
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
      .order("start_date", { ascending: true })
      .order("day_order", { ascending: true });
    assertQuerySuccess(error, { table: "events", action: "select" });
    return ((data ?? []) as DbEvent[]).map((row) => toLocalEvent(row, categories));
  });
};

export const loadRemoteData = async (): Promise<CalendarSnapshot> => {
  try {
    const categories = await fetchCategories();
    const events = await fetchEvents(categories);
    return { categories, events };
  } catch (error) {
    const syncError = classifySyncError(error);
    logDevError("sync.loadRemoteData", {
      kind: syncError.kind,
      message: syncError.message,
      retryable: syncError.retryable,
    });
    logProdError("Falha ao carregar dados remotos.");
    throw syncError;
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
        position: sanitizeIntegerField({
          table: "categories",
          action: "insert/update",
          field: "position",
          value: index,
          fallback: 0,
        }),
      }));

      const eventRows = snapshot.events.map((event) => ({
        id: ensureRowId(event.id),
        user_id: userId,
        title: event.title.trim(),
        category_id: event.categoryId,
        start_date: event.startDate || todayIso(),
        end_date: event.endDate || event.startDate || todayIso(),
        notes: event.notes?.trim() || null,
        day_order: sanitizeIntegerField({
          table: "events",
          action: "insert/update",
          field: "day_order",
          value: event.dayOrder,
          fallback: 0,
        }),
        created_at: event.createdAt || nowIso(),
      }));

      const [currentCategories, currentEvents] = await Promise.all([
        supabase.from("categories").select("id").eq("user_id", userId),
        supabase.from("events").select("id").eq("user_id", userId),
      ]);

      assertQuerySuccess(currentCategories.error, {
        table: "categories",
        action: "select",
      });
      assertQuerySuccess(currentEvents.error, {
        table: "events",
        action: "select",
      });

      if (categoryRows.length > 0) {
        const { error } = await supabase
          .from("categories")
          .upsert(categoryRows, { onConflict: "id" });
        assertQuerySuccess(error, {
          table: "categories",
          action: "insert/update",
        });
      }

      if (eventRows.length > 0) {
        const { error } = await supabase
          .from("events")
          .upsert(eventRows, { onConflict: "id" });
        assertQuerySuccess(error, {
          table: "events",
          action: "insert/update",
        });
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
        assertQuerySuccess(error, {
          table: "categories",
          action: "delete",
        });
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
        assertQuerySuccess(error, {
          table: "events",
          action: "delete",
        });
      }
    }, 1);
  } catch (error) {
    const syncError = classifySyncError(error);
    logDevError("sync.saveSnapshot", {
      kind: syncError.kind,
      message: syncError.message,
      retryable: syncError.retryable,
      userId,
    });
    logProdError("Falha ao salvar dados do usuario.");
    throw syncError;
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
      notes: event.notes ?? "",
      created_at: event.createdAt,
      day_order: event.dayOrder,
    }))
  );
  downloadFile(`doze52-events-${stamp}.csv`, eventsCsv, "text/csv;charset=utf-8");
};
