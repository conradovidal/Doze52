"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  ChartNoAxesColumn,
  Check,
  Clock3,
  ListTodo,
  LoaderCircle,
  MessageSquarePlus,
  Rocket,
  Sparkles,
  X,
} from "lucide-react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { ProfileIcon } from "@/components/profile-icon";
import { YearGrid } from "@/components/calendar/year-grid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { getTodayIsoInTimeZone } from "@/lib/date";
import {
  PRODUCT_FEEDBACK_AREAS,
  PRODUCT_FEEDBACK_AREA_LABEL,
  PRODUCT_FEEDBACK_AREA_STYLE,
  PRODUCT_FEEDBACK_SECTION_META,
  PRODUCT_FEEDBACK_STATUS_LABEL,
  canVoteOnProductFeedbackItem,
  type ProductFeedbackArea,
  type ProductFeedbackItem,
  type ProductFeedbackMatchCandidate,
  type ProductFeedbackSnapshot,
} from "@/lib/product-feedback";
import { expandEventsForYear } from "@/lib/recurrence";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const SECTION_ICON = {
  launched: Rocket,
  in_progress: Clock3,
  backlog: ListTodo,
} as const;

type SectionKey = keyof typeof PRODUCT_FEEDBACK_SECTION_META;

type VoteLimitPayload = {
  itemId: string;
  title: string;
  createdAt: string;
};

class ProductFeedbackClientError extends Error {
  code?: string;
  payload?: Record<string, unknown>;

  constructor(
    message: string,
    options?: { code?: string; payload?: Record<string, unknown> }
  ) {
    super(message);
    this.name = "ProductFeedbackClientError";
    this.code = options?.code;
    this.payload = options?.payload;
  }
}

const fetchJson = async <T,>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
    payload?: Record<string, unknown>;
  };

  if (!response.ok) {
    throw new ProductFeedbackClientError(
      payload.message ?? "Falha ao carregar o hub de melhorias.",
      {
        code: payload.error,
        payload: payload.payload,
      }
    );
  }

  return payload as T;
};

const PUBLIC_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const toPublicMonthYearLabel = (value: string) =>
  value.replace(/\s+de\s+/i, " ").replace(/^./, (character) => character.toUpperCase());

const formatPublicMonthYear = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return toPublicMonthYearLabel(PUBLIC_MONTH_YEAR_FORMATTER.format(parsed));
};

const getPublicItemMomentLabel = (item: ProductFeedbackItem) =>
  formatPublicMonthYear(item.launchedAt) ??
  formatPublicMonthYear(item.startedAt) ??
  item.timelineLabel;

type LaunchedMonthGroup = {
  key: string;
  label: string;
  items: ProductFeedbackItem[];
};

const groupLaunchedItemsByMonth = (items: ProductFeedbackItem[]) => {
  const groups = new Map<string, LaunchedMonthGroup>();
  const fallbackItems: ProductFeedbackItem[] = [];

  for (const item of items) {
    if (!item.launchedAt) {
      fallbackItems.push(item);
      continue;
    }

    const key = item.launchedAt.slice(0, 7);
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.items.push(item);
      continue;
    }

    groups.set(key, {
      key,
      label: formatPublicMonthYear(item.launchedAt) ?? item.launchedAt,
      items: [item],
    });
  }

  return {
    groups: Array.from(groups.values()),
    fallbackItems,
  };
};

function FrozenCalendarBackdrop() {
  const profiles = useStore((s) => s.profiles);
  const categories = useStore((s) => s.categories);
  const events = useStore((s) => s.events);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);

  const initialYear = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return currentYear >= 2025 && currentYear <= 2027 ? currentYear : 2026;
  }, []);
  const [todayIso, setTodayIso] = React.useState("");

  React.useEffect(() => {
    const browserTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setTodayIso(getTodayIsoInTimeZone(browserTimeZone));
  }, []);

  const renderEvents = React.useMemo(
    () => expandEventsForYear(events, initialYear),
    [events, initialYear]
  );
  const selectedProfiles = React.useMemo(
    () => profiles.filter((profile) => selectedProfileIds.includes(profile.id)),
    [profiles, selectedProfileIds]
  );
  const visibleCategories = React.useMemo(
    () =>
      categories
        .filter(
          (category) =>
            category.visible && selectedProfileIds.includes(category.profileId)
        )
        .slice(0, 6),
    [categories, selectedProfileIds]
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-background/28 dark:bg-background/34" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_30%),linear-gradient(180deg,rgba(248,250,252,0.34),rgba(248,250,252,0.12))] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.42),rgba(15,23,42,0.18))]" />

      <div className="relative h-full w-full overflow-hidden">
        <div className="absolute inset-0 scale-[1.015] opacity-[0.52] saturate-[0.88] blur-[1.2px] dark:opacity-[0.46]">
          <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-4 py-5 sm:px-6">
            <div className="mb-3 space-y-1">
              <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-3 md:gap-y-0">
                <div className="justify-self-start">
                  <Image
                    src="/logo-doze52.png"
                    alt=""
                    width={1549}
                    height={438}
                    className="h-8 w-auto md:h-9"
                  />
                </div>
                <div className="min-w-0 justify-self-end md:col-start-3">
                  <div className="inline-flex h-10 items-center rounded-2xl border border-neutral-200/80 bg-white/72 px-4 text-xl font-normal text-neutral-900 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-900/72 dark:text-neutral-100">
                    {initialYear}
                  </div>
                </div>
                <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1 md:flex md:justify-center">
                  <div className="flex w-full flex-wrap justify-center gap-2 md:w-[min(56rem,calc(100vw-2rem))]">
                    {selectedProfiles.map((profile) => (
                      <span
                        key={profile.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300/90 bg-white/75 px-3 py-1 text-xs text-neutral-700 dark:border-neutral-700/90 dark:bg-neutral-900/72 dark:text-neutral-200"
                      >
                        <ProfileIcon icon={profile.icon} size={12} />
                        {profile.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mx-auto flex w-full max-w-[56rem] flex-wrap justify-center gap-2">
                {visibleCategories.map((category) => (
                  <span
                    key={category.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm"
                    style={{ backgroundColor: category.color }}
                  >
                    <span className="h-2 w-2 rounded-full bg-white/80" />
                    {category.name}
                  </span>
                ))}
              </div>
              <div className="mx-auto h-px w-full max-w-[56rem] bg-border/60" />
            </div>

            <div className="flex-1 overflow-hidden rounded-[2rem]">
              <YearGrid
                year={initialYear}
                todayIso={todayIso}
                events={renderEvents}
                creatingRange={null}
                onEditEvent={() => {}}
                onStartCreateRange={() => {}}
                onHoverCreateRange={() => {}}
                onFinishCreateRange={() => {}}
                onMoveEventByDelta={() => {}}
                onApplyDayReorder={() => {}}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function useProductFeedbackSnapshot(initialSnapshot: ProductFeedbackSnapshot) {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = React.useState(initialSnapshot);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchJson<ProductFeedbackSnapshot>(
        "/api/melhorias/snapshot",
        {
          cache: "no-store",
        }
      );
      setSnapshot(next);
      return next;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Falha ao carregar o hub de melhorias."
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh, session?.user.id]);

  return { snapshot, setSnapshot, loading, error, refresh };
}

function FeedbackAreaBadge({ area }: { area: ProductFeedbackArea }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        PRODUCT_FEEDBACK_AREA_STYLE[area]
      )}
    >
      {PRODUCT_FEEDBACK_AREA_LABEL[area]}
    </span>
  );
}

function ItemVoteButton({
  item,
  busy,
  onVote,
  requireAuth,
}: {
  item: ProductFeedbackItem;
  busy: boolean;
  onVote: (itemId: string) => void;
  requireAuth: () => void;
}) {
  const { session } = useAuth();
  if (!canVoteOnProductFeedbackItem(item.status)) {
    return null;
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={item.viewerHasVoted ? "premium" : "outline"}
      className="rounded-full"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        if (!session) {
          requireAuth();
          return;
        }
        onVote(item.id);
      }}
    >
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {item.viewerHasVoted ? "Apoiando" : "Apoiar"}
    </Button>
  );
}

function ProductFeedbackCard({
  item,
  rank,
  voteBusy,
  onOpen,
  onVote,
  requireAuth,
}: {
  item: ProductFeedbackItem;
  rank?: number;
  voteBusy: boolean;
  onOpen: (itemId: string) => void;
  onVote: (itemId: string) => void;
  requireAuth: () => void;
}) {
  const itemMomentLabel = getPublicItemMomentLabel(item);
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="group flex w-full flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-background/56 p-4 text-left backdrop-blur transition-all hover:border-border hover:bg-background/76 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {typeof rank === "number" ? (
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-neutral-300/80 bg-background/90 px-2 text-[11px] font-semibold text-muted-foreground dark:border-neutral-600/60">
                #{rank}
              </span>
            ) : null}
            <FeedbackAreaBadge area={item.area} />
            <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {PRODUCT_FEEDBACK_STATUS_LABEL[item.status]}
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-neutral-900 dark:group-hover:text-neutral-50">
              {item.title}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>
          </div>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{item.voteCount} votos</span>
          <span>{item.reinforcementCount} reforços</span>
          {itemMomentLabel ? <span>{itemMomentLabel}</span> : null}
        </div>
        <ItemVoteButton
          item={item}
          busy={voteBusy}
          onVote={onVote}
          requireAuth={requireAuth}
        />
      </div>
    </button>
  );
}

function LaunchedFeedbackCard({
  item,
  onOpen,
  fallbackMomentLabel,
}: {
  item: ProductFeedbackItem;
  onOpen: (itemId: string) => void;
  fallbackMomentLabel?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="w-full rounded-[1.5rem] border border-border/70 bg-background/46 p-4 text-left backdrop-blur transition-colors hover:bg-background/70 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {fallbackMomentLabel ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {fallbackMomentLabel}
            </p>
          ) : null}
          <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {item.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FeedbackAreaBadge area={item.area} />
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
        {item.highlights.map((highlight) => (
          <li key={highlight} className="flex gap-2">
            <span className="mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

function SectionEmptyState({
  sectionKey,
}: {
  sectionKey: SectionKey;
}) {
  const meta = PRODUCT_FEEDBACK_SECTION_META[sectionKey];
  return (
    <div className="mt-6 rounded-[1.5rem] border border-dashed border-border bg-background/42 p-6 backdrop-blur sm:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {meta.emptyStateTitle}
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
        {meta.emptyStateBody}
      </p>
    </div>
  );
}

function ProductFeedbackDetailsDialog({
  item,
  open,
  onOpenChange,
  onVote,
  voteBusy,
  requireAuth,
}: {
  item: ProductFeedbackItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVote: (itemId: string) => void;
  voteBusy: boolean;
  requireAuth: () => void;
}) {
  if (!item) return null;
  const itemMomentLabel = getPublicItemMomentLabel(item);
  const itemMomentTitle =
    item.status === "launched" ? "Foi para produção" : "Momento";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        mobileMode="sheet"
        className="max-h-[85vh] overflow-y-auto rounded-[1.75rem] border-border/70 bg-background/92 p-5 sm:max-w-2xl sm:p-6"
      >
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <FeedbackAreaBadge area={item.area} />
            <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {PRODUCT_FEEDBACK_STATUS_LABEL[item.status]}
            </span>
          </div>
          <DialogTitle className="pt-2 text-2xl leading-tight">
            {item.title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-muted-foreground">
            {item.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Votos
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {item.voteCount}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Reforços
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {item.reinforcementCount}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {itemMomentTitle}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {itemMomentLabel ?? "No fluxo atual"}
            </div>
          </div>
        </div>

        {item.publicNote ? (
          <section className="rounded-[1.5rem] border border-border/70 bg-background/64 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Nota do time
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {item.publicNote}
            </p>
          </section>
        ) : null}

        {item.highlights.length > 0 ? (
          <section className="rounded-[1.5rem] border border-border/70 bg-background/64 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Destaques
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {item.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-2">
                  <span className="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <DialogFooter className="items-center justify-between gap-3 sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {canVoteOnProductFeedbackItem(item.status)
              ? "Cada pessoa pode apoiar até 3 prioridades ao mesmo tempo."
              : "Este item já saiu da fila ativa de votos."}
          </div>
          <ItemVoteButton
            item={item}
            busy={voteBusy}
            onVote={onVote}
            requireAuth={requireAuth}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoteSwapDialog({
  open,
  onOpenChange,
  activeVotes,
  selectedReplaceItemId,
  onSelectReplaceItemId,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeVotes: VoteLimitPayload[];
  selectedReplaceItemId: string | null;
  onSelectReplaceItemId: (itemId: string) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mobileMode="sheet" className="rounded-[1.75rem] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escolha qual prioridade sai</DialogTitle>
          <DialogDescription>
            Você já está apoiando 3 itens. Para apoiar um quarto, substitua um dos votos atuais.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {activeVotes.map((vote) => {
            const isSelected = vote.itemId === selectedReplaceItemId;
            return (
              <button
                key={vote.itemId}
                type="button"
                onClick={() => onSelectReplaceItemId(vote.itemId)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "border-neutral-900 bg-neutral-900 text-neutral-50 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-border/70 bg-background/70 hover:bg-background"
                )}
              >
                <span className="text-sm font-medium">{vote.title}</span>
                {isSelected ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="premium"
            disabled={!selectedReplaceItemId || busy}
            onClick={onConfirm}
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Substituir voto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionDialog({
  open,
  onOpenChange,
  activeVoteItems,
  voteLimit,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeVoteItems: ProductFeedbackItem[];
  voteLimit: number;
  onSubmitted: (snapshot: ProductFeedbackSnapshot) => void;
}) {
  const [rawText, setRawText] = React.useState("");
  const [proposedArea, setProposedArea] = React.useState<ProductFeedbackArea | "">("");
  const [matches, setMatches] = React.useState<ProductFeedbackMatchCandidate[]>([]);
  const [selectedMatchId, setSelectedMatchId] = React.useState<string | null>(null);
  const [castVote, setCastVote] = React.useState(true);
  const [replaceVoteItemId, setReplaceVoteItemId] = React.useState<string | null>(null);
  const [honeypot, setHoneypot] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setRawText("");
      setProposedArea("");
      setMatches([]);
      setSelectedMatchId(null);
      setCastVote(true);
      setReplaceVoteItemId(null);
      setHoneypot("");
      setBusy(false);
      setError(null);
      setSuccessMessage(null);
      return;
    }
    const normalized = rawText.trim();
    if (normalized.length < 6) {
      setMatches([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const payload = await fetchJson<{ matches: ProductFeedbackMatchCandidate[] }>(
          "/api/melhorias/match",
          {
            method: "POST",
            body: JSON.stringify({ text: normalized }),
          }
        );
        setMatches(payload.matches);
      } catch {
        setMatches([]);
      }
    }, 260);

    return () => window.clearTimeout(timeout);
  }, [open, rawText]);

  const selectedMatch = React.useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId]
  );

  const hasVoteCapacity = activeVoteItems.length < voteLimit;
  const alreadyVotingForSelected = selectedMatch
    ? activeVoteItems.some((item) => item.id === selectedMatch.id)
    : false;
  const mustChooseReplacement =
    Boolean(selectedMatch) && castVote && !hasVoteCapacity && !alreadyVotingForSelected;

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetchJson<{
        snapshot: ProductFeedbackSnapshot;
      }>("/api/melhorias/submissions", {
        method: "POST",
        body: JSON.stringify({
          rawText,
          proposedArea: proposedArea || null,
          matchedItemId: selectedMatchId,
          castVote: selectedMatchId ? castVote : false,
          replaceVoteItemId: mustChooseReplacement ? replaceVoteItemId : null,
          honeypot,
        }),
      });
      onSubmitted(response.snapshot);
      setSuccessMessage(
        selectedMatchId
          ? "Reforço registrado. Obrigado por ajudar a lapidar a prioridade."
          : "Sugestão recebida. Ela entra primeiro em revisão antes de aparecer publicamente."
      );
      setRawText("");
      setProposedArea("");
      setMatches([]);
      setSelectedMatchId(null);
      setReplaceVoteItemId(null);
      setCastVote(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar sua melhoria agora."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto rounded-[1.75rem] border-border/70 bg-background/94 sm:max-w-2xl"
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-2xl">Sugerir uma melhoria</DialogTitle>
          <DialogDescription className="text-sm leading-6">
            Conte o resultado que faria diferença no seu uso do doze52. Antes de abrir um item novo, vamos procurar algo parecido para consolidar melhor o sinal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              O que você gostaria de ver?
            </span>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={6}
              className="min-h-36 w-full rounded-2xl border border-input bg-transparent px-4 py-3 text-sm leading-6 outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              placeholder="Ex.: queria conseguir acompanhar recorrências com mais contexto visual sem poluir o ano inteiro..."
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">
                Área sugerida
              </span>
              <Select
                value={proposedArea || "__empty__"}
                onValueChange={(value) =>
                  setProposedArea(value === "__empty__" ? "" : (value as ProductFeedbackArea))
                }
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Deixe em aberto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">Deixe em aberto</SelectItem>
                  {PRODUCT_FEEDBACK_AREAS.map((area) => (
                    <SelectItem key={area} value={area}>
                      {PRODUCT_FEEDBACK_AREA_LABEL[area]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="hidden">
              <span>Se você está vendo isto, deixe vazio</span>
              <Input
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
            </label>
          </div>

          {matches.length > 0 ? (
            <section className="rounded-[1.5rem] border border-border/70 bg-background/64 p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Itens parecidos
              </div>
              <div className="mt-3 space-y-2">
                {matches.map((match) => {
                  const isSelected = match.id === selectedMatchId;
                  return (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => {
                        setSelectedMatchId(isSelected ? null : match.id);
                        setReplaceVoteItemId(null);
                      }}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                        isSelected
                          ? "border-neutral-900 bg-neutral-900 text-neutral-50 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                          : "border-border/70 bg-background/72 hover:bg-background"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{match.title}</div>
                        <div className="text-xs leading-5 opacity-80">{match.summary}</div>
                      </div>
                      <div className="shrink-0 text-xs opacity-80">
                        {match.voteCount} votos
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {selectedMatch ? (
            <section className="rounded-[1.5rem] border border-emerald-200/80 bg-emerald-50/80 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <div className="font-medium">Você vai reforçar um item existente.</div>
              <p className="mt-1 leading-6">
                Seu texto entra como contexto adicional para a equipe, sem abrir uma duplicata pública.
              </p>
              <label className="mt-4 flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={castVote}
                  onChange={(event) => setCastVote(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border border-input"
                />
                <span className="leading-6">
                  Também quero usar um dos meus votos ativos neste item.
                </span>
              </label>
              {selectedMatch && castVote && alreadyVotingForSelected ? (
                <p className="mt-3 text-xs leading-5">
                  Você já está apoiando esta melhoria. O voto não vai consumir um slot novo.
                </p>
              ) : null}
              {mustChooseReplacement ? (
                <label className="mt-4 block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Qual voto deve sair?
                  </span>
                  <Select
                    value={replaceVoteItemId ?? "__empty__"}
                    onValueChange={(value) =>
                      setReplaceVoteItemId(value === "__empty__" ? null : value)
                    }
                  >
                    <SelectTrigger className="w-full rounded-xl bg-background/90">
                      <SelectValue placeholder="Escolha uma prioridade para substituir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">
                        Escolha uma prioridade
                      </SelectItem>
                      {activeVoteItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ) : null}
            </section>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {successMessage ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {successMessage}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="premium"
            disabled={
              busy ||
              rawText.trim().length < 16 ||
              (mustChooseReplacement && !replaceVoteItemId)
            }
            onClick={handleSubmit}
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {selectedMatch ? "Registrar reforço" : "Enviar melhoria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductUpdatesHub({
  initialSnapshot,
}: {
  initialSnapshot: ProductFeedbackSnapshot;
}) {
  const backlogActionsRef = React.useRef<HTMLDivElement | null>(null);
  const backlogListRef = React.useRef<HTMLDivElement | null>(null);
  const { session, loading: authLoading } = useAuth();
  const { snapshot, setSnapshot, loading, error, refresh } =
    useProductFeedbackSnapshot(initialSnapshot);
  const [activeSection, setActiveSection] = React.useState<SectionKey>(() => {
    if (initialSnapshot.backlog.length > 0) return "backlog";
    if (initialSnapshot.inProgress.length > 0) return "in_progress";
    return "launched";
  });
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);
  const [suggestionOpen, setSuggestionOpen] = React.useState(false);
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);
  const [authDialogAnchorPoint, setAuthDialogAnchorPoint] = React.useState<
    { x: number; y: number } | undefined
  >(undefined);
  const [message, setMessage] = React.useState<string | null>(null);
  const [voteBusyItemId, setVoteBusyItemId] = React.useState<string | null>(null);
  const [voteSwapState, setVoteSwapState] = React.useState<{
    targetItemId: string | null;
    activeVotes: VoteLimitPayload[];
    selectedReplaceItemId: string | null;
  }>({
    targetItemId: null,
    activeVotes: [],
    selectedReplaceItemId: null,
  });

  const currentSection = PRODUCT_FEEDBACK_SECTION_META[activeSection];
  const CurrentIcon = SECTION_ICON[activeSection];
  const sectionItems =
    activeSection === "launched"
      ? snapshot.launched
      : activeSection === "in_progress"
        ? snapshot.inProgress
        : snapshot.backlog;
  const selectedItem =
    snapshot.items.find((item) => item.id === selectedItemId) ?? null;
  const activeVoteItems = snapshot.items.filter((item) =>
    snapshot.viewerActiveVoteItemIds.includes(item.id)
  );
  const launchedMonthGroups = React.useMemo(
    () => groupLaunchedItemsByMonth(snapshot.launched),
    [snapshot.launched]
  );
  const remainingVotes = Math.max(
    snapshot.viewerVoteLimit - snapshot.viewerActiveVoteItemIds.length,
    0
  );
  const remainingVotesLabel = `${remainingVotes} ${
    remainingVotes === 1 ? "voto" : "votos"
  }`;

  const openAuthDialog = React.useCallback(
    (anchorPoint?: { x: number; y: number }) => {
      setAuthDialogAnchorPoint(anchorPoint);
      setAuthDialogOpen(true);
    },
    []
  );

  const requireAuthFromEvent = (event?: React.MouseEvent<HTMLElement>) => {
    if (!event) {
      openAuthDialog(undefined);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    openAuthDialog({ x: rect.right, y: rect.bottom });
  };

  const handleSuggestionCta = (event?: React.MouseEvent<HTMLElement>) => {
    if (!session) {
      requireAuthFromEvent(event);
      return;
    }

    setSuggestionOpen(true);
  };

  const focusOpportunities = React.useCallback(() => {
    const target = backlogListRef.current ?? backlogActionsRef.current;
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    window.setTimeout(() => {
      target.focus({ preventScroll: true });
    }, 180);
  }, []);

  const handleVotesCta = (event?: React.MouseEvent<HTMLElement>) => {
    if (!session) {
      requireAuthFromEvent(event);
      return;
    }

    focusOpportunities();
  };

  const handleVote = async (itemId: string, replaceItemId?: string | null) => {
    setVoteBusyItemId(itemId);
    setMessage(null);
    try {
      const payload = await fetchJson<{
        state: "added" | "removed" | "already_active";
        snapshot: ProductFeedbackSnapshot;
      }>("/api/melhorias/votes", {
        method: "POST",
        body: JSON.stringify({
          itemId,
          replaceItemId: replaceItemId ?? null,
        }),
      });
      setSnapshot(payload.snapshot);
      setVoteSwapState({
        targetItemId: null,
        activeVotes: [],
        selectedReplaceItemId: null,
      });
      setMessage(
        payload.state === "removed"
          ? "Voto removido."
          : payload.state === "already_active"
            ? "Você já estava apoiando esta prioridade."
            : "Voto registrado."
      );
    } catch (error) {
      if (
        error instanceof ProductFeedbackClientError &&
        error.code === "vote_limit_reached"
      ) {
        const activeVotes = Array.isArray(error.payload?.activeVotes)
          ? (error.payload?.activeVotes as VoteLimitPayload[])
          : [];
        setVoteSwapState({
          targetItemId: itemId,
          activeVotes,
          selectedReplaceItemId: activeVotes[0]?.itemId ?? null,
        });
        return;
      }
      setMessage(
        error instanceof Error ? error.message : "Não foi possível registrar o voto."
      );
    } finally {
      setVoteBusyItemId(null);
    }
  };

  const steps = [
    {
      title: "Sugira",
      body: "Conte o resultado que faria diferença e deixe o time lapidar o backlog com contexto real.",
      icon: MessageSquarePlus,
    },
    {
      title: "Vote em até 3 prioridades",
      body: "Cada pessoa sustenta só o que realmente importa, o que torna o ranking mais honesto.",
      icon: ChartNoAxesColumn,
    },
    {
      title: "Acompanhe o status",
      body: "Histórico, oportunidades de melhoria e implementação do roadmap convivem na mesma leitura.",
      icon: Sparkles,
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent">
      <FrozenCalendarBackdrop />
      <div className="absolute inset-0 bg-background/22 backdrop-blur-[8px] dark:bg-background/28" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/76 shadow-[0_30px_120px_-60px_rgba(15,23,42,0.65)] backdrop-blur-2xl">
          <div className="flex items-start justify-end px-4 pt-4 sm:px-6 sm:pt-5">
            <Link
              href="/"
              aria-label="Fechar e voltar ao calendário"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-background/78 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col gap-6 px-5 pb-5 sm:px-8 sm:pb-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Evolução do produto
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Melhorias &amp; Prioridades
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  O ponto público onde o doze52 mostra o que já evoluiu, o que está em avaliação e onde a comunidade pode ajudar a puxar o produto para frente.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="premium"
                  size="lg"
                  className="h-12 rounded-full border border-neutral-900/10 px-5 text-sm shadow-[0_20px_55px_-24px_rgba(15,23,42,0.55)] dark:border-neutral-100/10"
                  onClick={handleSuggestionCta}
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  Sugerir uma melhoria
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {steps.map((step) => (
                  <div
                    key={step.title}
                    className="rounded-[1.5rem] border border-border/70 bg-background/56 p-4 backdrop-blur"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <step.icon className="h-3.5 w-3.5" />
                      {step.title}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["launched", snapshot.counts.launched],
                  ["in_progress", snapshot.counts.inProgress],
                  ["backlog", snapshot.counts.backlog],
                ] as Array<[SectionKey, number]>
              ).map(([sectionKey, count]) => {
                const meta = PRODUCT_FEEDBACK_SECTION_META[sectionKey];
                const Icon = SECTION_ICON[sectionKey];
                const isActive = sectionKey === activeSection;
                return (
                  <button
                    key={sectionKey}
                    type="button"
                    onClick={() => setActiveSection(sectionKey)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "border-neutral-900 bg-neutral-900 text-neutral-50 shadow-sm dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                        : "border-border/80 bg-background/72 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {meta.label}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        isActive
                          ? "bg-neutral-50/15 text-neutral-50 dark:bg-neutral-900/10 dark:text-neutral-900"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <section className="rounded-[2rem] border border-border/70 bg-background/58 p-5 backdrop-blur-xl sm:p-8">
              <div className="flex flex-col gap-2 border-b border-border/70 pb-5">
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  <CurrentIcon className="h-3.5 w-3.5" />
                  {currentSection.eyebrow}
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {currentSection.title}
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {currentSection.description}
                </p>
                {activeSection === "backlog" ? (
                  <div
                    ref={backlogActionsRef}
                    tabIndex={-1}
                    className="mt-3 flex flex-col gap-3 outline-none sm:flex-row sm:flex-wrap"
                  >
                    <Button
                      type="button"
                      variant="premium"
                      size="lg"
                      className="h-12 rounded-full px-5 text-sm shadow-[0_20px_55px_-24px_rgba(15,23,42,0.55)]"
                      onClick={handleVotesCta}
                    >
                      <ChartNoAxesColumn className="h-4 w-4" />
                      {remainingVotesLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-12 rounded-full border-border/80 bg-background/82 px-5 text-sm shadow-sm hover:bg-background"
                      onClick={handleSuggestionCta}
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                      Sugerir melhoria
                    </Button>
                  </div>
                ) : null}
              </div>

              {loading ? (
                <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Atualizando prioridades...
                </div>
              ) : null}

              {error ? (
                <div className="mt-6 rounded-[1.5rem] border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  {error}
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    className="ml-2 underline underline-offset-4"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : null}

              {message ? (
                <div className="mt-6 rounded-[1.5rem] border border-emerald-200/80 bg-emerald-50/80 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                  {message}
                </div>
              ) : null}

              {activeSection === "launched" ? (
                sectionItems.length > 0 ? (
                  <div className="relative mt-6 space-y-8 pl-5 sm:pl-8">
                    <div className="absolute bottom-3 left-[7px] top-1 w-px bg-border sm:left-[11px]" />
                    {launchedMonthGroups.groups.map((group) => (
                      <section key={group.key} className="relative space-y-3">
                        <div className="absolute -left-5 top-2.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-neutral-900 dark:bg-neutral-100 sm:-left-8" />
                        <div className="pl-0.5">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {group.label}
                          </p>
                        </div>
                        <div className="space-y-3">
                          {group.items.map((item) => (
                            <article key={item.id}>
                              <LaunchedFeedbackCard
                                item={item}
                                onOpen={setSelectedItemId}
                              />
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                    {launchedMonthGroups.fallbackItems.map((item) => (
                      <article key={item.id} className="relative">
                        <div className="absolute -left-5 top-2.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-neutral-900 dark:bg-neutral-100 sm:-left-8" />
                        <LaunchedFeedbackCard
                          item={item}
                          onOpen={setSelectedItemId}
                          fallbackMomentLabel={item.timelineLabel}
                        />
                      </article>
                    ))}
                  </div>
                ) : (
                  <SectionEmptyState sectionKey="launched" />
                )
              ) : sectionItems.length > 0 ? (
                <div
                  ref={activeSection === "backlog" ? backlogListRef : undefined}
                  tabIndex={activeSection === "backlog" ? -1 : undefined}
                  className="mt-6 grid gap-4 outline-none"
                >
                  {sectionItems.map((item) => (
                    <ProductFeedbackCard
                      key={item.id}
                      item={item}
                      voteBusy={voteBusyItemId === item.id}
                      onOpen={setSelectedItemId}
                      onVote={(itemId) => void handleVote(itemId)}
                      requireAuth={() => openAuthDialog(undefined)}
                    />
                  ))}
                </div>
              ) : (
                <SectionEmptyState sectionKey={activeSection} />
              )}
            </section>
          </div>
        </section>

        {!authLoading && !session ? (
          <div className="rounded-[1.5rem] border border-border/70 bg-background/72 px-5 py-4 text-sm text-muted-foreground backdrop-blur">
            Leitura pública aberta. Para votar, reforçar uma ideia ou enviar uma melhoria nova, entre com sua conta.
          </div>
        ) : null}
      </div>

      <ProductFeedbackDetailsDialog
        item={selectedItem}
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedItemId(null);
        }}
        onVote={(itemId) => void handleVote(itemId)}
        voteBusy={voteBusyItemId === selectedItem?.id}
        requireAuth={() => openAuthDialog(undefined)}
      />

      <SuggestionDialog
        open={suggestionOpen}
        onOpenChange={setSuggestionOpen}
        activeVoteItems={activeVoteItems}
        voteLimit={snapshot.viewerVoteLimit}
        onSubmitted={(nextSnapshot) => {
          setSnapshot(nextSnapshot);
        }}
      />

      <VoteSwapDialog
        open={Boolean(voteSwapState.targetItemId)}
        onOpenChange={(open) => {
          if (!open) {
            setVoteSwapState({
              targetItemId: null,
              activeVotes: [],
              selectedReplaceItemId: null,
            });
          }
        }}
        activeVotes={voteSwapState.activeVotes}
        selectedReplaceItemId={voteSwapState.selectedReplaceItemId}
        onSelectReplaceItemId={(itemId) =>
          setVoteSwapState((current) => ({
            ...current,
            selectedReplaceItemId: itemId,
          }))
        }
        busy={Boolean(voteBusyItemId)}
        onConfirm={() => {
          if (!voteSwapState.targetItemId || !voteSwapState.selectedReplaceItemId) return;
          void handleVote(
            voteSwapState.targetItemId,
            voteSwapState.selectedReplaceItemId
          );
        }}
      />

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={(open) => {
          setAuthDialogOpen(open);
          if (!open) {
            setAuthDialogAnchorPoint(undefined);
          }
        }}
        anchorPoint={authDialogAnchorPoint}
      />
    </main>
  );
}
