import type { User } from "@supabase/supabase-js";
import {
  PRODUCT_FEEDBACK_AREAS,
  PRODUCT_FEEDBACK_STATUSES,
  buildFallbackProductFeedbackSnapshot,
  buildProductFeedbackSnapshot,
  canVoteOnProductFeedbackItem,
  matchProductFeedbackItemsLocally,
  normalizeProductFeedbackText,
  slugifyProductFeedbackTitle,
  type ProductFeedbackAdminDashboard,
  type ProductFeedbackAdminQueueEntry,
  type ProductFeedbackArea,
  type ProductFeedbackItem,
  type ProductFeedbackMatchCandidate,
  type ProductFeedbackSnapshot,
  type ProductFeedbackStatus,
  type ProductFeedbackSubmissionRecord,
  type ProductFeedbackSubmissionStatus,
} from "@/lib/product-feedback";
import {
  getAuthenticatedServerUser,
  getSupabaseAdminClient,
  getSupabaseServerClient,
  hasSupabaseAdminEnv,
  hasSupabaseServerEnv,
} from "@/lib/supabase-server";

type SupabaseLike = Awaited<ReturnType<typeof getSupabaseServerClient>>;

type DbProductFeedbackItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  public_note: string | null;
  area: string;
  status: string;
  backlog_rank: number | null;
  started_at: string | null;
  launched_at: string | null;
  timeline_label: string | null;
  highlights: string[] | null;
  merged_into_item_id: string | null;
  created_at: string;
  updated_at: string;
};

type DbProductFeedbackPublicStat = {
  item_id: string;
  vote_count: number | null;
  reinforcement_count: number | null;
};

type DbProductFeedbackVote = {
  id: string;
  user_id: string;
  item_id: string;
  created_at: string;
  ended_at: string | null;
  end_reason: string | null;
};

type DbProductFeedbackSubmission = {
  id: string;
  user_id: string;
  raw_text: string;
  proposed_area: string | null;
  matched_item_id: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  moderation_note: string | null;
  created_at: string;
  updated_at: string;
};

const PRODUCT_FEEDBACK_SUBMISSION_COOLDOWN_MS = 60_000;
const PRODUCT_FEEDBACK_DAILY_SUBMISSION_LIMIT = 6;
const PRODUCT_FEEDBACK_VOTE_LIMIT = 3;
const PRODUCT_FEEDBACK_MIN_TEXT_LENGTH = 16;
const PRODUCT_FEEDBACK_MAX_TEXT_LENGTH = 700;

export class ProductFeedbackError extends Error {
  status: number;
  code: string;
  payload?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    payload?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
    this.name = "ProductFeedbackError";
  }
}

const isArea = (value: string | null | undefined): value is ProductFeedbackArea =>
  Boolean(value && PRODUCT_FEEDBACK_AREAS.includes(value as ProductFeedbackArea));

const isStatus = (value: string | null | undefined): value is ProductFeedbackStatus =>
  Boolean(value && PRODUCT_FEEDBACK_STATUSES.includes(value as ProductFeedbackStatus));

const toProductFeedbackItem = (
  row: DbProductFeedbackItem,
  statsByItemId: Map<string, DbProductFeedbackPublicStat>,
  viewerActiveVoteIds: Set<string>
): ProductFeedbackItem => {
  const stats = statsByItemId.get(row.id);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    publicNote: row.public_note,
    area: isArea(row.area) ? row.area : "Geral",
    status: isStatus(row.status) ? row.status : "backlog",
    backlogRank: row.backlog_rank,
    startedAt: row.started_at,
    launchedAt: row.launched_at,
    timelineLabel: row.timeline_label,
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
    mergedIntoItemId: row.merged_into_item_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    voteCount: Math.max(0, Number(stats?.vote_count ?? 0)),
    reinforcementCount: Math.max(0, Number(stats?.reinforcement_count ?? 0)),
    viewerHasVoted: viewerActiveVoteIds.has(row.id),
  };
};

const toSubmissionRecord = (
  row: DbProductFeedbackSubmission
): ProductFeedbackSubmissionRecord => ({
  id: row.id,
  userId: row.user_id,
  rawText: row.raw_text,
  proposedArea: isArea(row.proposed_area) ? row.proposed_area : null,
  matchedItemId: row.matched_item_id,
  status: row.status as ProductFeedbackSubmissionStatus,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  moderationNote: row.moderation_note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const isFeedbackSchemaMissing = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const code =
    "code" in error && typeof error.code === "string" ? error.code : null;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("product_feedback") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
};

const getViewerActiveVoteItemIds = async (
  supabase: SupabaseLike,
  userId: string | null
) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("product_feedback_votes")
    .select("item_id")
    .eq("user_id", userId)
    .is("ended_at", null);
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.item_id)
    .filter((value): value is string => typeof value === "string");
};

const getPublicFeedbackRows = async (supabase: SupabaseLike) => {
  const [{ data: items, error: itemsError }, { data: stats, error: statsError }] =
    await Promise.all([
      supabase
        .from("product_feedback_items")
        .select(
          "id, slug, title, summary, public_note, area, status, backlog_rank, started_at, launched_at, timeline_label, highlights, merged_into_item_id, created_at, updated_at"
        )
        .is("merged_into_item_id", null)
        .in("status", ["backlog", "in_progress", "launched"])
        .order("created_at", { ascending: true }),
      supabase
        .from("product_feedback_public_stats")
        .select("item_id, vote_count, reinforcement_count"),
    ]);

  if (itemsError) throw itemsError;
  if (statsError) throw statsError;

  return {
    items: (items ?? []) as DbProductFeedbackItem[],
    stats: (stats ?? []) as DbProductFeedbackPublicStat[],
  };
};

const attachAggregatesToItems = (
  rows: DbProductFeedbackItem[],
  stats: DbProductFeedbackPublicStat[],
  viewerActiveVoteItemIds: string[]
) => {
  const statsByItemId = new Map(stats.map((entry) => [entry.item_id, entry]));
  const viewerSet = new Set(viewerActiveVoteItemIds);
  return rows.map((row) => toProductFeedbackItem(row, statsByItemId, viewerSet));
};

export const loadProductFeedbackSnapshot = async (
  viewerUserId?: string | null
): Promise<ProductFeedbackSnapshot> => {
  if (!hasSupabaseServerEnv) {
    return buildFallbackProductFeedbackSnapshot();
  }

  try {
    const supabase = await getSupabaseServerClient();
    const [{ items, stats }, viewerActiveVoteItemIds] = await Promise.all([
      getPublicFeedbackRows(supabase),
      getViewerActiveVoteItemIds(supabase, viewerUserId ?? null),
    ]);

    return buildProductFeedbackSnapshot(
      attachAggregatesToItems(items, stats, viewerActiveVoteItemIds),
      {
        viewerActiveVoteItemIds,
        viewerVoteLimit: PRODUCT_FEEDBACK_VOTE_LIMIT,
      }
    );
  } catch (error) {
    if (isFeedbackSchemaMissing(error)) {
      return buildFallbackProductFeedbackSnapshot();
    }
    throw error;
  }
};

export const loadServerViewerFeedbackSnapshot = async () => {
  const user = await getAuthenticatedServerUser();
  return loadProductFeedbackSnapshot(user?.id ?? null);
};

const validateFeedbackText = (rawText: string) => {
  const trimmed = rawText.trim();
  if (trimmed.length < PRODUCT_FEEDBACK_MIN_TEXT_LENGTH) {
    throw new ProductFeedbackError(
      400,
      "validation_error",
      "Descreva a melhoria com um pouco mais de contexto."
    );
  }
  if (trimmed.length > PRODUCT_FEEDBACK_MAX_TEXT_LENGTH) {
    throw new ProductFeedbackError(
      400,
      "validation_error",
      "A sugestao ficou longa demais. Tente resumir em ate 700 caracteres."
    );
  }
  if (normalizeProductFeedbackText(trimmed).split(" ").length < 4) {
    throw new ProductFeedbackError(
      400,
      "validation_error",
      "Tente explicar a melhoria com um pouco mais de detalhe."
    );
  }
  return trimmed;
};

const requireAuthenticatedFeedbackUser = async () => {
  if (!hasSupabaseServerEnv) {
    throw new ProductFeedbackError(
      503,
      "feedback_unavailable",
      "O hub de melhorias ainda nao esta configurado neste ambiente."
    );
  }
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ProductFeedbackError(401, "not_authenticated", "Faca login para continuar.");
  }
  return { supabase, user: data.user };
};

const getUserActiveVotes = async (supabase: SupabaseLike, userId: string) => {
  const { data, error } = await supabase
    .from("product_feedback_votes")
    .select("id, user_id, item_id, created_at, ended_at, end_reason")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbProductFeedbackVote[];
};

const getVoteLimitPayload = async (
  supabase: SupabaseLike,
  activeVotes: DbProductFeedbackVote[]
) => {
  const ids = activeVotes.map((vote) => vote.item_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("product_feedback_items")
    .select("id, title")
    .in("id", ids);
  if (error) throw error;
  const titleById = new Map(
    (data ?? [])
      .filter(
        (row): row is { id: string; title: string } =>
          typeof row.id === "string" && typeof row.title === "string"
      )
      .map((row) => [row.id, row.title])
  );
  return activeVotes.map((vote) => ({
    itemId: vote.item_id,
    title: titleById.get(vote.item_id) ?? "Prioridade atual",
    createdAt: vote.created_at,
  }));
};

const getPublicItemById = async (supabase: SupabaseLike, itemId: string) => {
  const { data, error } = await supabase
    .from("product_feedback_items")
    .select("id, status")
    .eq("id", itemId)
    .is("merged_into_item_id", null)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const mutateProductFeedbackVote = async (params: {
  itemId: string;
  replaceItemId?: string | null;
  ensureOnly?: boolean;
}) => {
  const { supabase, user } = await requireAuthenticatedFeedbackUser();
  const targetItem = await getPublicItemById(supabase, params.itemId);
  if (!targetItem) {
    throw new ProductFeedbackError(404, "item_not_found", "Item nao encontrado.");
  }
  const status = targetItem.status as ProductFeedbackStatus;
  if (!canVoteOnProductFeedbackItem(status)) {
    throw new ProductFeedbackError(
      400,
      "vote_not_allowed",
      "So e possivel votar em itens de backlog ou em andamento."
    );
  }

  const activeVotes = await getUserActiveVotes(supabase, user.id);
  const existingVote = activeVotes.find((vote) => vote.item_id === params.itemId);

  if (existingVote && !params.ensureOnly) {
    const { error } = await supabase
      .from("product_feedback_votes")
      .update({
        ended_at: new Date().toISOString(),
        end_reason: "user_removed",
      })
      .eq("id", existingVote.id)
      .eq("user_id", user.id)
      .is("ended_at", null);
    if (error) throw error;

    const snapshot = await loadProductFeedbackSnapshot(user.id);
    return {
      state: "removed" as const,
      snapshot,
    };
  }

  if (existingVote && params.ensureOnly) {
    const snapshot = await loadProductFeedbackSnapshot(user.id);
    return {
      state: "already_active" as const,
      snapshot,
    };
  }

  if (activeVotes.length >= PRODUCT_FEEDBACK_VOTE_LIMIT) {
    const replaceItemId = params.replaceItemId?.trim() || null;
    if (!replaceItemId) {
      throw new ProductFeedbackError(
        409,
        "vote_limit_reached",
        "Voce ja esta apoiando 3 prioridades. Escolha uma para substituir.",
        {
          activeVotes: await getVoteLimitPayload(supabase, activeVotes),
          limit: PRODUCT_FEEDBACK_VOTE_LIMIT,
        }
      );
    }
    const voteToReplace = activeVotes.find((vote) => vote.item_id === replaceItemId);
    if (!voteToReplace) {
      throw new ProductFeedbackError(
        400,
        "replace_vote_missing",
        "A prioridade escolhida para sair nao esta entre seus votos ativos."
      );
    }
    const { error: replaceError } = await supabase
      .from("product_feedback_votes")
      .update({
        ended_at: new Date().toISOString(),
        end_reason: "vote_replaced",
      })
      .eq("id", voteToReplace.id)
      .eq("user_id", user.id)
      .is("ended_at", null);
    if (replaceError) throw replaceError;
  }

  const { error: insertError } = await supabase.from("product_feedback_votes").insert({
    user_id: user.id,
    item_id: params.itemId,
  });
  if (insertError) throw insertError;

  const snapshot = await loadProductFeedbackSnapshot(user.id);
  return {
    state: "added" as const,
    snapshot,
  };
};

const findRecentSimilarSubmission = async (
  supabase: SupabaseLike,
  userId: string,
  normalizedText: string
) => {
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("product_feedback_submissions")
    .select("raw_text")
    .eq("user_id", userId)
    .gte("created_at", sinceIso);
  if (error) throw error;
  return (data ?? []).some((row) => {
    const rawText =
      typeof row.raw_text === "string" ? normalizeProductFeedbackText(row.raw_text) : "";
    return rawText === normalizedText;
  });
};

const enforceSubmissionLimits = async (
  supabase: SupabaseLike,
  userId: string,
  normalizedText: string
) => {
  const cooldownSince = new Date(
    Date.now() - PRODUCT_FEEDBACK_SUBMISSION_COOLDOWN_MS
  ).toISOString();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [
    { data: cooldownRows, error: cooldownError },
    { count: dailyCount, error: dailyError },
  ] = await Promise.all([
    supabase
      .from("product_feedback_submissions")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", cooldownSince)
      .limit(1),
    supabase
      .from("product_feedback_submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayStart.toISOString()),
  ]);

  if (cooldownError) throw cooldownError;
  if (dailyError) throw dailyError;

  if ((cooldownRows ?? []).length > 0) {
    throw new ProductFeedbackError(
      429,
      "submission_cooldown",
      "Espere um instante antes de enviar outra melhoria."
    );
  }

  if ((dailyCount ?? 0) >= PRODUCT_FEEDBACK_DAILY_SUBMISSION_LIMIT) {
    throw new ProductFeedbackError(
      429,
      "submission_limit",
      "Voce atingiu o limite diario de novas sugestoes por enquanto."
    );
  }

  const isDuplicate = await findRecentSimilarSubmission(supabase, userId, normalizedText);
  if (isDuplicate) {
    throw new ProductFeedbackError(
      409,
      "duplicate_submission",
      "Parece que voce ja enviou algo muito parecido recentemente."
    );
  }
};

export const findProductFeedbackMatches = async (
  text: string
): Promise<ProductFeedbackMatchCandidate[]> => {
  const normalizedText = normalizeProductFeedbackText(text);
  if (normalizedText.length < 6) return [];
  if (!hasSupabaseServerEnv) {
    return matchProductFeedbackItemsLocally(
      buildFallbackProductFeedbackSnapshot().items,
      normalizedText
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc("match_product_feedback_items", {
      query_text: text,
      max_results: 5,
    });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map((entry) => ({
      id: String(entry.id ?? ""),
      slug: String(entry.slug ?? ""),
      title: String(entry.title ?? ""),
      summary: String(entry.summary ?? ""),
      area: isArea(String(entry.area ?? "")) ? (entry.area as ProductFeedbackArea) : "Geral",
      status: isStatus(String(entry.status ?? ""))
        ? (entry.status as ProductFeedbackStatus)
        : "backlog",
      voteCount: Number(entry.vote_count ?? 0),
      reinforcementCount: Number(entry.reinforcement_count ?? 0),
      similarity: Number(entry.similarity ?? 0),
    }));
  } catch (error) {
    if (isFeedbackSchemaMissing(error)) {
      return matchProductFeedbackItemsLocally(
        buildFallbackProductFeedbackSnapshot().items,
        normalizedText
      );
    }
    throw error;
  }
};

export const createProductFeedbackSubmission = async (params: {
  rawText: string;
  proposedArea?: ProductFeedbackArea | null;
  matchedItemId?: string | null;
  castVote?: boolean;
  replaceVoteItemId?: string | null;
  honeypot?: string | null;
}) => {
  if ((params.honeypot ?? "").trim().length > 0) {
    throw new ProductFeedbackError(
      400,
      "spam_blocked",
      "Nao foi possivel processar o envio."
    );
  }

  const { supabase, user } = await requireAuthenticatedFeedbackUser();
  const rawText = validateFeedbackText(params.rawText);
  const normalizedText = normalizeProductFeedbackText(rawText);

  await enforceSubmissionLimits(supabase, user.id, normalizedText);

  const matchedItemId = params.matchedItemId?.trim() || null;
  let status: ProductFeedbackSubmissionStatus = "pending_review";
  let reviewedAt: string | null = null;
  let moderationNote: string | null = null;

  if (matchedItemId) {
    const targetItem = await getPublicItemById(supabase, matchedItemId);
    if (!targetItem) {
      throw new ProductFeedbackError(
        404,
        "item_not_found",
        "Nao encontramos a melhoria escolhida para reforco."
      );
    }
    status = "merged_existing";
    reviewedAt = new Date().toISOString();
    moderationNote = "Reforco registrado pelo proprio usuario no item existente.";
  }

  const payload = {
    user_id: user.id,
    raw_text: rawText,
    proposed_area: params.proposedArea && isArea(params.proposedArea)
      ? params.proposedArea
      : null,
    matched_item_id: matchedItemId,
    status,
    reviewed_at: reviewedAt,
    moderation_note: moderationNote,
  };

  const { data, error } = await supabase
    .from("product_feedback_submissions")
    .insert(payload)
    .select(
      "id, user_id, raw_text, proposed_area, matched_item_id, status, reviewed_by, reviewed_at, moderation_note, created_at, updated_at"
    )
    .single();
  if (error) throw error;

  let voteResult:
    | Awaited<ReturnType<typeof mutateProductFeedbackVote>>
    | null = null;

  if (matchedItemId && params.castVote) {
    voteResult = await mutateProductFeedbackVote({
      itemId: matchedItemId,
      replaceItemId: params.replaceVoteItemId,
      ensureOnly: true,
    });
  }

  return {
    submission: toSubmissionRecord(data as DbProductFeedbackSubmission),
    voteResult,
  };
};

export const requireProductFeedbackAdmin = async (): Promise<User> => {
  const user = await getAuthenticatedServerUser();
  if (!user) {
    throw new ProductFeedbackError(401, "not_authenticated", "Faca login para continuar.");
  }
  if (!hasSupabaseAdminEnv) {
    throw new ProductFeedbackError(
      503,
      "admin_unavailable",
      "A area administrativa nao esta configurada neste ambiente."
    );
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("product_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new ProductFeedbackError(
      403,
      "forbidden",
      "Voce nao tem acesso a esta area."
    );
  }
  return user;
};

const getNextBacklogRank = async () => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("product_feedback_items")
    .select("backlog_rank")
    .eq("status", "backlog")
    .order("backlog_rank", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const record =
    data && typeof data === "object" && "backlog_rank" in data
      ? (data as { backlog_rank?: number | null })
      : null;
  return Math.max(0, Number(record?.backlog_rank ?? -1) + 1);
};

const loadAdminItems = async () => {
  const admin = getSupabaseAdminClient();
  const [{ data: items, error: itemsError }, { data: stats, error: statsError }] =
    await Promise.all([
      admin
        .from("product_feedback_items")
        .select(
          "id, slug, title, summary, public_note, area, status, backlog_rank, started_at, launched_at, timeline_label, highlights, merged_into_item_id, created_at, updated_at"
        )
        .order("created_at", { ascending: true }),
      admin
        .from("product_feedback_public_stats")
        .select("item_id, vote_count, reinforcement_count"),
    ]);
  if (itemsError) throw itemsError;
  if (statsError) throw statsError;
  return attachAggregatesToItems(
    (items ?? []) as DbProductFeedbackItem[],
    (stats ?? []) as DbProductFeedbackPublicStat[],
    []
  );
};

export const loadProductFeedbackAdminDashboard =
  async (): Promise<ProductFeedbackAdminDashboard> => {
    await requireProductFeedbackAdmin();

    const admin = getSupabaseAdminClient();
    const items = await loadAdminItems();

    const { data: submissions, error } = await admin
      .from("product_feedback_submissions")
      .select(
        "id, user_id, raw_text, proposed_area, matched_item_id, status, reviewed_by, reviewed_at, moderation_note, created_at, updated_at"
      )
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const pendingSubmissions: ProductFeedbackAdminQueueEntry[] = (
      (submissions ?? []) as DbProductFeedbackSubmission[]
    ).map((submission) => ({
      ...toSubmissionRecord(submission),
      candidateMatches: matchProductFeedbackItemsLocally(items, submission.raw_text),
    }));

    return {
      pendingSubmissions,
      items,
      isConfigured: true,
    };
  };

const parseHighlights = (highlights: string[] | string | null | undefined) => {
  if (Array.isArray(highlights)) {
    return highlights.map((entry) => entry.trim()).filter(Boolean);
  }
  if (typeof highlights === "string") {
    return highlights
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const toNullableDate = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const moderateProductFeedbackSubmission = async (params: {
  submissionId: string;
  action: "merge" | "promote" | "reject";
  targetItemId?: string | null;
  title?: string;
  summary?: string;
  publicNote?: string | null;
  area?: ProductFeedbackArea;
  status?: ProductFeedbackStatus;
  highlights?: string[] | string | null;
}) => {
  const adminUser = await requireProductFeedbackAdmin();
  const admin = getSupabaseAdminClient();

  const { data: submission, error: submissionError } = await admin
    .from("product_feedback_submissions")
    .select(
      "id, user_id, raw_text, proposed_area, matched_item_id, status, reviewed_by, reviewed_at, moderation_note, created_at, updated_at"
    )
    .eq("id", params.submissionId)
    .maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission) {
    throw new ProductFeedbackError(404, "submission_not_found", "Sugestao nao encontrada.");
  }

  const reviewedAt = new Date().toISOString();

  if (params.action === "reject") {
    const { error } = await admin
      .from("product_feedback_submissions")
      .update({
        status: "rejected",
        reviewed_by: adminUser.id,
        reviewed_at: reviewedAt,
      })
      .eq("id", params.submissionId);
    if (error) throw error;
    return;
  }

  if (params.action === "merge") {
    const targetItemId = params.targetItemId?.trim() || submission.matched_item_id;
    if (!targetItemId) {
      throw new ProductFeedbackError(
        400,
        "target_item_required",
        "Escolha o item canônico para consolidar esta sugestao."
      );
    }
    const { error } = await admin
      .from("product_feedback_submissions")
      .update({
        status: "merged_existing",
        matched_item_id: targetItemId,
        reviewed_by: adminUser.id,
        reviewed_at: reviewedAt,
      })
      .eq("id", params.submissionId);
    if (error) throw error;
    return;
  }

  const title = params.title?.trim();
  const summary = params.summary?.trim();
  const area = params.area && isArea(params.area) ? params.area : submission.proposed_area;
  const status = params.status && isStatus(params.status) ? params.status : "backlog";

  if (!title || !summary || !area || !isArea(area)) {
    throw new ProductFeedbackError(
      400,
      "promotion_payload_invalid",
      "Titulo, resumo e area sao obrigatorios para promover um item novo."
    );
  }

  const backlogRank = status === "backlog" ? await getNextBacklogRank() : null;
  const nowIso = new Date().toISOString();
  const launchedAt = status === "launched" ? nowIso.slice(0, 10) : null;
  const startedAt = status === "in_progress" ? nowIso.slice(0, 10) : null;

  const { data: createdItem, error: createError } = await admin
    .from("product_feedback_items")
    .insert({
      slug: slugifyProductFeedbackTitle(title),
      title,
      summary,
      public_note: params.publicNote?.trim() || null,
      area,
      status,
      backlog_rank: backlogRank,
      started_at: startedAt,
      launched_at: launchedAt,
      timeline_label: launchedAt ? launchedAt : null,
      highlights: parseHighlights(params.highlights),
    })
    .select("id")
    .single();
  if (createError) throw createError;

  const { error: updateSubmissionError } = await admin
    .from("product_feedback_submissions")
    .update({
      status: "promoted_new",
      matched_item_id: createdItem.id,
      reviewed_by: adminUser.id,
      reviewed_at: reviewedAt,
    })
    .eq("id", params.submissionId);
  if (updateSubmissionError) throw updateSubmissionError;
};

export const upsertProductFeedbackItem = async (params: {
  action: "create" | "update" | "merge_items";
  itemId?: string;
  targetItemId?: string;
  title?: string;
  summary?: string;
  publicNote?: string | null;
  area?: ProductFeedbackArea;
  status?: ProductFeedbackStatus;
  backlogRank?: number | null;
  startedAt?: string | null;
  launchedAt?: string | null;
  timelineLabel?: string | null;
  highlights?: string[] | string | null;
}) => {
  await requireProductFeedbackAdmin();
  const admin = getSupabaseAdminClient();

  if (params.action === "merge_items") {
    const sourceId = params.itemId?.trim();
    const targetId = params.targetItemId?.trim();
    if (!sourceId || !targetId || sourceId === targetId) {
      throw new ProductFeedbackError(
        400,
        "merge_items_invalid",
        "Escolha dois itens diferentes para fundir."
      );
    }

    const [{ data: sourceVotes, error: sourceVotesError }, { data: targetVotes, error: targetVotesError }] =
      await Promise.all([
        admin
          .from("product_feedback_votes")
          .select("id, user_id, item_id, created_at")
          .eq("item_id", sourceId)
          .is("ended_at", null),
        admin
          .from("product_feedback_votes")
          .select("user_id")
          .eq("item_id", targetId)
          .is("ended_at", null),
      ]);

    if (sourceVotesError) throw sourceVotesError;
    if (targetVotesError) throw targetVotesError;

    const targetUserIds = new Set(
      (targetVotes ?? [])
        .map((row) => row.user_id)
        .filter((value): value is string => typeof value === "string")
    );

    for (const vote of (sourceVotes ?? []) as Array<{
      id: string;
      user_id: string;
      item_id: string;
      created_at: string;
    }>) {
      const endReason = "item_merged";
      const { error: endError } = await admin
        .from("product_feedback_votes")
        .update({
          ended_at: new Date().toISOString(),
          end_reason: endReason,
        })
        .eq("id", vote.id)
        .is("ended_at", null);
      if (endError) throw endError;

      if (!targetUserIds.has(vote.user_id)) {
        const { error: transferError } = await admin
          .from("product_feedback_votes")
          .insert({
            user_id: vote.user_id,
            item_id: targetId,
          });
        if (transferError) throw transferError;
        targetUserIds.add(vote.user_id);
      }
    }

    const { error: moveSubmissionsError } = await admin
      .from("product_feedback_submissions")
      .update({ matched_item_id: targetId })
      .eq("matched_item_id", sourceId);
    if (moveSubmissionsError) throw moveSubmissionsError;

    const { error: mergeItemError } = await admin
      .from("product_feedback_items")
      .update({
        merged_into_item_id: targetId,
        status: "archived",
      })
      .eq("id", sourceId);
    if (mergeItemError) throw mergeItemError;
    return;
  }

  const title = params.title?.trim();
  const summary = params.summary?.trim();
  const area = params.area && isArea(params.area) ? params.area : null;
  const status = params.status && isStatus(params.status) ? params.status : "backlog";

  if (!title || !summary || !area) {
    throw new ProductFeedbackError(
      400,
      "item_payload_invalid",
      "Titulo, resumo e area sao obrigatorios."
    );
  }

  const payload = {
    slug: slugifyProductFeedbackTitle(title),
    title,
    summary,
    public_note: params.publicNote?.trim() || null,
    area,
    status,
    backlog_rank:
      status === "backlog"
        ? typeof params.backlogRank === "number"
          ? params.backlogRank
          : await getNextBacklogRank()
        : null,
    started_at: status === "in_progress" ? toNullableDate(params.startedAt) : null,
    launched_at: status === "launched" ? toNullableDate(params.launchedAt) : null,
    timeline_label: params.timelineLabel?.trim() || null,
    highlights: parseHighlights(params.highlights),
  };

  if (params.action === "create") {
    const { error } = await admin.from("product_feedback_items").insert(payload);
    if (error) throw error;
    return;
  }

  if (!params.itemId) {
    throw new ProductFeedbackError(
      400,
      "item_id_required",
      "Escolha qual item deseja atualizar."
    );
  }

  const { error } = await admin
    .from("product_feedback_items")
    .update(payload)
    .eq("id", params.itemId);
  if (error) throw error;
};
