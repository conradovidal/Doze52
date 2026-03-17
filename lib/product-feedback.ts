import {
  PRODUCT_UPDATE_MILESTONES,
  type ProductUpdateCategory,
} from "@/lib/product-updates";

export const PRODUCT_FEEDBACK_AREAS = [
  "Calendario",
  "Perfis",
  "Interface",
  "Sincronizacao",
  "Geral",
] as const;

export type ProductFeedbackArea = (typeof PRODUCT_FEEDBACK_AREAS)[number];

export const PRODUCT_FEEDBACK_STATUSES = [
  "backlog",
  "in_progress",
  "launched",
  "archived",
] as const;

export type ProductFeedbackStatus = (typeof PRODUCT_FEEDBACK_STATUSES)[number];

export const PRODUCT_FEEDBACK_SUBMISSION_STATUSES = [
  "pending_review",
  "merged_existing",
  "promoted_new",
  "rejected",
] as const;

export type ProductFeedbackSubmissionStatus =
  (typeof PRODUCT_FEEDBACK_SUBMISSION_STATUSES)[number];

export type ProductFeedbackItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publicNote: string | null;
  area: ProductFeedbackArea;
  status: ProductFeedbackStatus;
  backlogRank: number | null;
  startedAt: string | null;
  launchedAt: string | null;
  timelineLabel: string | null;
  highlights: string[];
  mergedIntoItemId: string | null;
  createdAt: string;
  updatedAt: string;
  voteCount: number;
  reinforcementCount: number;
  viewerHasVoted: boolean;
};

export type ProductFeedbackSnapshot = {
  items: ProductFeedbackItem[];
  backlog: ProductFeedbackItem[];
  inProgress: ProductFeedbackItem[];
  launched: ProductFeedbackItem[];
  topVoted: ProductFeedbackItem[];
  viewerActiveVoteItemIds: string[];
  viewerVoteLimit: number;
  counts: {
    backlog: number;
    inProgress: number;
    launched: number;
    activeVotes: number;
  };
  generatedAt: string;
  isFallback: boolean;
};

export type ProductFeedbackMatchCandidate = Pick<
  ProductFeedbackItem,
  "id" | "slug" | "title" | "summary" | "area" | "status" | "voteCount" | "reinforcementCount"
> & {
  similarity: number;
};

export type ProductFeedbackSubmissionRecord = {
  id: string;
  userId: string;
  rawText: string;
  proposedArea: ProductFeedbackArea | null;
  matchedItemId: string | null;
  status: ProductFeedbackSubmissionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  moderationNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductFeedbackAdminQueueEntry = ProductFeedbackSubmissionRecord & {
  candidateMatches: ProductFeedbackMatchCandidate[];
};

export type ProductFeedbackAdminDashboard = {
  pendingSubmissions: ProductFeedbackAdminQueueEntry[];
  items: ProductFeedbackItem[];
  isConfigured: boolean;
};

export const PRODUCT_FEEDBACK_SECTION_META = {
  launched: {
    key: "launched",
    label: "Lancadas",
    eyebrow: "Ja no produto",
    title: "O que ja melhoramos no doze52",
    description:
      "Marcos importantes da evolucao do produto, sempre com foco no que mudou para quem usa o calendario no dia a dia.",
    emptyStateTitle: "Ainda sem marcos publicados",
    emptyStateBody:
      "Quando novas entregas forem para o ar, elas vao aparecer aqui com contexto do que mudou.",
  },
  in_progress: {
    key: "in_progress",
    label: "Em andamento",
    eyebrow: "Em construcao",
    title: "O que estamos construindo agora",
    description:
      "Transparencia sobre melhorias que ja sairam do backlog e entraram em execucao.",
    emptyStateTitle: "Nada em execucao agora",
    emptyStateBody:
      "Quando abrirmos uma frente nova, voce vai ver aqui o que esta sendo construido, sem promessas vagas.",
  },
  backlog: {
    key: "backlog",
    label: "Oportunidades de melhoria",
    eyebrow: "Em avaliacao",
    title: "O que estamos tratando como oportunidades de melhoria",
    description:
      "Ideias publicas, refinadas e consolidadas, para a comunidade acompanhar o que vale aprofundar nas proximas fases.",
    emptyStateTitle: "Sem oportunidades publicas ainda",
    emptyStateBody:
      "A camada publica esta abrindo. Se voce sentir falta de algo importante, envie a primeira melhoria.",
  },
} as const;

export const PRODUCT_FEEDBACK_AREA_LABEL: Record<ProductFeedbackArea, string> = {
  Calendario: "Calendario",
  Perfis: "Perfis",
  Interface: "Interface",
  Sincronizacao: "Sincronizacao",
  Geral: "Geral",
};

export const PRODUCT_FEEDBACK_STATUS_LABEL: Record<ProductFeedbackStatus, string> = {
  backlog: "Oportunidade",
  in_progress: "Em andamento",
  launched: "Lancada",
  archived: "Arquivada",
};

export const PRODUCT_FEEDBACK_AREA_STYLE: Record<ProductFeedbackArea, string> = {
  Calendario:
    "border-sky-200/80 bg-sky-50/80 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  Perfis:
    "border-emerald-200/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  Interface:
    "border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  Sincronizacao:
    "border-violet-200/80 bg-violet-50/80 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
  Geral:
    "border-neutral-200/80 bg-neutral-50/80 text-neutral-700 dark:border-neutral-600/50 dark:bg-neutral-500/10 dark:text-neutral-200",
};

const LEGACY_LAUNCHED_AT_BY_INDEX = [
  "2026-02-11",
  "2026-02-13",
  "2026-02-20",
  "2026-02-28",
  "2026-03-08",
  "2026-03-10",
  "2026-03-12",
] as const;

const LEGACY_CREATED_AT_BY_INDEX = [
  "2026-02-11T09:00:00.000Z",
  "2026-02-13T09:00:00.000Z",
  "2026-02-20T09:00:00.000Z",
  "2026-02-28T09:00:00.000Z",
  "2026-03-08T09:00:00.000Z",
  "2026-03-10T09:00:00.000Z",
  "2026-03-12T09:00:00.000Z",
] as const;

const mapLegacyCategoryToArea = (
  categories: ProductUpdateCategory[]
): ProductFeedbackArea => {
  const first = categories[0];
  if (first === "Calendario") return "Calendario";
  if (first === "Perfis") return "Perfis";
  if (first === "Interface") return "Interface";
  if (first === "Sincronizacao") return "Sincronizacao";
  return "Geral";
};

export const slugifyProductFeedbackTitle = (value: string) =>
  normalizeProductFeedbackText(value)
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72) || "melhoria";

export const normalizeProductFeedbackText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const scoreMatch = (candidate: ProductFeedbackItem, query: string) => {
  const normalizedCandidate = normalizeProductFeedbackText(
    `${candidate.title} ${candidate.summary} ${candidate.publicNote ?? ""} ${candidate.area}`
  );
  if (!normalizedCandidate) return 0;
  if (normalizedCandidate.includes(query)) return 1;
  const queryTokens = query.split(" ").filter(Boolean);
  if (queryTokens.length === 0) return 0;
  const candidateTokens = new Set(normalizedCandidate.split(" ").filter(Boolean));
  const overlap = queryTokens.filter((token) => candidateTokens.has(token)).length;
  return overlap / queryTokens.length;
};

export const matchProductFeedbackItemsLocally = (
  items: ProductFeedbackItem[],
  query: string,
  limit = 5
): ProductFeedbackMatchCandidate[] => {
  const normalizedQuery = normalizeProductFeedbackText(query);
  if (normalizedQuery.length < 6) return [];

  return items
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      area: item.area,
      status: item.status,
      voteCount: item.voteCount,
      reinforcementCount: item.reinforcementCount,
      similarity: scoreMatch(item, normalizedQuery),
    }))
    .filter((item) => item.similarity >= 0.45)
    .sort((a, b) => {
      if (b.similarity !== a.similarity) return b.similarity - a.similarity;
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      if (b.reinforcementCount !== a.reinforcementCount) {
        return b.reinforcementCount - a.reinforcementCount;
      }
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
};

export const canVoteOnProductFeedbackItem = (status: ProductFeedbackStatus) =>
  status === "backlog" || status === "in_progress";

export const buildProductFeedbackSnapshot = (
  items: ProductFeedbackItem[],
  options?: {
    viewerActiveVoteItemIds?: string[];
    generatedAt?: string;
    isFallback?: boolean;
    viewerVoteLimit?: number;
  }
): ProductFeedbackSnapshot => {
  const visibleItems = items.filter((item) => item.mergedIntoItemId == null);
  const launched = visibleItems
    .filter((item) => item.status === "launched")
    .sort((a, b) => {
      const left = a.launchedAt ?? a.createdAt;
      const right = b.launchedAt ?? b.createdAt;
      return right.localeCompare(left);
    });
  const inProgress = visibleItems
    .filter((item) => item.status === "in_progress")
    .sort((a, b) => {
      const left = a.startedAt ?? a.createdAt;
      const right = b.startedAt ?? b.createdAt;
      return right.localeCompare(left);
    });
  const backlog = visibleItems
    .filter((item) => item.status === "backlog")
    .sort((a, b) => {
      const leftRank = a.backlogRank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = b.backlogRank ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      return a.createdAt.localeCompare(b.createdAt);
    });
  const topVoted = visibleItems
    .filter((item) => canVoteOnProductFeedbackItem(item.status))
    .sort((a, b) => {
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      if (b.reinforcementCount !== a.reinforcementCount) {
        return b.reinforcementCount - a.reinforcementCount;
      }
      const leftRank = a.backlogRank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = b.backlogRank ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return a.createdAt.localeCompare(b.createdAt);
    });

  return {
    items: visibleItems,
    backlog,
    inProgress,
    launched,
    topVoted,
    viewerActiveVoteItemIds: options?.viewerActiveVoteItemIds ?? [],
    viewerVoteLimit: options?.viewerVoteLimit ?? 3,
    counts: {
      backlog: backlog.length,
      inProgress: inProgress.length,
      launched: launched.length,
      activeVotes: visibleItems.reduce((total, item) => total + item.voteCount, 0),
    },
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    isFallback: options?.isFallback ?? false,
  };
};

export const LEGACY_LAUNCHED_PRODUCT_FEEDBACK_ITEMS: ProductFeedbackItem[] =
  PRODUCT_UPDATE_MILESTONES.map((milestone, index) => {
    const summary = milestone.bullets[0] ?? milestone.title;
    const publicNote =
      milestone.bullets.length > 1 ? milestone.bullets.slice(1).join(" ") : null;
    const launchedAt = LEGACY_LAUNCHED_AT_BY_INDEX[index] ?? "2026-02-11";
    const createdAt = LEGACY_CREATED_AT_BY_INDEX[index] ?? `${launchedAt}T09:00:00.000Z`;
    return {
      id: `legacy-${index + 1}`,
      slug: slugifyProductFeedbackTitle(milestone.title),
      title: milestone.title,
      summary,
      publicNote,
      area: mapLegacyCategoryToArea(milestone.categories),
      status: "launched",
      backlogRank: null,
      startedAt: null,
      launchedAt,
      timelineLabel: milestone.dateLabel,
      highlights: milestone.bullets,
      mergedIntoItemId: null,
      createdAt,
      updatedAt: createdAt,
      voteCount: 0,
      reinforcementCount: 0,
      viewerHasVoted: false,
    };
  });

export const buildFallbackProductFeedbackSnapshot = () =>
  buildProductFeedbackSnapshot(LEGACY_LAUNCHED_PRODUCT_FEEDBACK_ITEMS, {
    isFallback: true,
    viewerActiveVoteItemIds: [],
  });
