"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
  PRODUCT_FEEDBACK_AREAS,
  PRODUCT_FEEDBACK_AREA_LABEL,
  PRODUCT_FEEDBACK_STATUS_LABEL,
  type ProductFeedbackAdminDashboard,
  type ProductFeedbackArea,
  type ProductFeedbackItem,
  type ProductFeedbackStatus,
} from "@/lib/product-feedback";

class ProductFeedbackAdminClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductFeedbackAdminClientError";
  }
}

const fetchAdminJson = async <T,>(
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
  };
  if (!response.ok) {
    throw new ProductFeedbackAdminClientError(
      payload.message ?? "Falha ao carregar a area administrativa."
    );
  }
  return payload as T;
};

function QueueCard({
  entry,
  items,
  onDashboardChange,
}: {
  entry: ProductFeedbackAdminDashboard["pendingSubmissions"][number];
  items: ProductFeedbackItem[];
  onDashboardChange: (dashboard: ProductFeedbackAdminDashboard) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [targetItemId, setTargetItemId] = React.useState<string>(
    entry.candidateMatches[0]?.id ?? ""
  );
  const [title, setTitle] = React.useState(() =>
    entry.rawText.trim().slice(0, 80) || "Nova melhoria"
  );
  const [summary, setSummary] = React.useState(() =>
    entry.rawText.trim().slice(0, 180) || "Resumo da melhoria"
  );
  const [area, setArea] = React.useState<ProductFeedbackArea>(
    entry.proposedArea ?? "Geral"
  );
  const [status, setStatus] = React.useState<ProductFeedbackStatus>("backlog");
  const [publicNote, setPublicNote] = React.useState("");

  const runAction = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const dashboard = await fetchAdminJson<ProductFeedbackAdminDashboard>(
        "/api/melhorias/admin/submissions",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      onDashboardChange(dashboard);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha na moderacao.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-[1.5rem] border border-border/70 bg-background/72 p-5 backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pendente de revisao
          </div>
          <p className="text-base leading-7 text-foreground">{entry.rawText}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Usuario: {entry.userId.slice(0, 8)}...</span>
            <span>
              Area sugerida: {entry.proposedArea ? PRODUCT_FEEDBACK_AREA_LABEL[entry.proposedArea] : "Aberta"}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="dangerSoft"
          size="sm"
          disabled={busy}
          onClick={() =>
            void runAction({
              submissionId: entry.id,
              action: "reject",
            })
          }
        >
          Rejeitar
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
          <div className="text-sm font-medium text-foreground">
            Consolidar em item existente
          </div>
          <Select value={targetItemId || "__empty__"} onValueChange={setTargetItemId}>
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue placeholder="Escolha um item canônico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">Escolha um item</SelectItem>
              {entry.candidateMatches.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </SelectItem>
              ))}
              {items
                .filter(
                  (item) =>
                    !entry.candidateMatches.some(
                      (candidate) => candidate.id === item.id
                    )
                )
                .map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!targetItemId || busy}
            onClick={() =>
              void runAction({
                submissionId: entry.id,
                action: "merge",
                targetItemId,
              })
            }
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Fundir com item existente
          </Button>
        </div>

        <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
          <div className="text-sm font-medium text-foreground">
            Promover para item novo
          </div>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={4}
            className="min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={area} onValueChange={(value) => setArea(value as ProductFeedbackArea)}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_FEEDBACK_AREAS.map((entryArea) => (
                  <SelectItem key={entryArea} value={entryArea}>
                    {PRODUCT_FEEDBACK_AREA_LABEL[entryArea]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as ProductFeedbackStatus)}
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">Backlog</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="launched">Lancada</SelectItem>
                <SelectItem value="archived">Arquivada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <textarea
            value={publicNote}
            onChange={(event) => setPublicNote(event.target.value)}
            rows={3}
            className="min-h-24 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            placeholder="Nota publica opcional para o item"
          />
          <Button
            type="button"
            size="sm"
            variant="premium"
            disabled={!title.trim() || !summary.trim() || busy}
            onClick={() =>
              void runAction({
                submissionId: entry.id,
                action: "promote",
                title,
                summary,
                publicNote: publicNote || null,
                area,
                status,
              })
            }
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Criar item novo
          </Button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </article>
  );
}

function EditableItemCard({
  item,
  items,
  onDashboardChange,
}: {
  item: ProductFeedbackItem;
  items: ProductFeedbackItem[];
  onDashboardChange: (dashboard: ProductFeedbackAdminDashboard) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState(item.title);
  const [summary, setSummary] = React.useState(item.summary);
  const [publicNote, setPublicNote] = React.useState(item.publicNote ?? "");
  const [area, setArea] = React.useState<ProductFeedbackArea>(item.area);
  const [status, setStatus] = React.useState<ProductFeedbackStatus>(item.status);
  const [backlogRank, setBacklogRank] = React.useState(
    item.backlogRank != null ? String(item.backlogRank) : ""
  );
  const [startedAt, setStartedAt] = React.useState(item.startedAt ?? "");
  const [launchedAt, setLaunchedAt] = React.useState(item.launchedAt ?? "");
  const [timelineLabel, setTimelineLabel] = React.useState(item.timelineLabel ?? "");
  const [highlights, setHighlights] = React.useState(item.highlights.join("\n"));
  const [mergeTargetId, setMergeTargetId] = React.useState("");

  const runAction = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const dashboard = await fetchAdminJson<ProductFeedbackAdminDashboard>(
        "/api/melhorias/admin/items",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      onDashboardChange(dashboard);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao atualizar item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-[1.5rem] border border-border/70 bg-background/72 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {PRODUCT_FEEDBACK_STATUS_LABEL[item.status]}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {item.voteCount} votos · {item.reinforcementCount} reforcos
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="premium"
          disabled={busy}
          onClick={() =>
            void runAction({
              action: "update",
              itemId: item.id,
              title,
              summary,
              publicNote: publicNote || null,
              area,
              status,
              backlogRank: backlogRank.trim() ? Number(backlogRank) : null,
              startedAt: startedAt || null,
              launchedAt: launchedAt || null,
              timelineLabel: timelineLabel || null,
              highlights,
            })
          }
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          Salvar
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={4}
          className="min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        <textarea
          value={publicNote}
          onChange={(event) => setPublicNote(event.target.value)}
          rows={4}
          className="min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Nota publica"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={area} onValueChange={(value) => setArea(value as ProductFeedbackArea)}>
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_FEEDBACK_AREAS.map((entryArea) => (
                <SelectItem key={entryArea} value={entryArea}>
                  {PRODUCT_FEEDBACK_AREA_LABEL[entryArea]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as ProductFeedbackStatus)}
          >
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="launched">Lancada</SelectItem>
              <SelectItem value="archived">Arquivada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            value={backlogRank}
            onChange={(event) => setBacklogRank(event.target.value)}
            placeholder="Rank backlog"
          />
          <Input
            type="date"
            value={startedAt}
            onChange={(event) => setStartedAt(event.target.value)}
          />
          <Input
            type="date"
            value={launchedAt}
            onChange={(event) => setLaunchedAt(event.target.value)}
          />
        </div>
        <Input
          value={timelineLabel}
          onChange={(event) => setTimelineLabel(event.target.value)}
          placeholder="Timeline label"
        />
        <textarea
          value={highlights}
          onChange={(event) => setHighlights(event.target.value)}
          rows={4}
          className="min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Um highlight por linha"
        />
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
        <div className="text-sm font-medium text-foreground">Fundir item</div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <Select value={mergeTargetId || "__empty__"} onValueChange={setMergeTargetId}>
            <SelectTrigger className="w-full rounded-xl sm:flex-1">
              <SelectValue placeholder="Escolha o item canônico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">Escolha um item</SelectItem>
              {items
                .filter((candidate) => candidate.id !== item.id && !candidate.mergedIntoItemId)
                .map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            disabled={!mergeTargetId || mergeTargetId === "__empty__" || busy}
            onClick={() =>
              void runAction({
                action: "merge_items",
                itemId: item.id,
                targetItemId: mergeTargetId,
              })
            }
          >
            Fundir
          </Button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </article>
  );
}

export function ProductFeedbackAdmin() {
  const { session, loading: authLoading } = useAuth();
  const [dashboard, setDashboard] = React.useState<ProductFeedbackAdminDashboard | null>(
    null
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newSummary, setNewSummary] = React.useState("");
  const [newArea, setNewArea] = React.useState<ProductFeedbackArea>("Geral");
  const [newStatus, setNewStatus] = React.useState<ProductFeedbackStatus>("backlog");
  const [newPublicNote, setNewPublicNote] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const nextDashboard = await fetchAdminJson<ProductFeedbackAdminDashboard>(
        "/api/melhorias/admin/dashboard",
        {
          cache: "no-store",
        }
      );
      setDashboard(nextDashboard);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Falha ao carregar a area administrativa."
      );
    } finally {
      setLoading(false);
    }
  }, [session]);

  React.useEffect(() => {
    if (!session) return;
    void refresh();
  }, [refresh, session]);

  const createManualItem = async () => {
    setCreating(true);
    setError(null);
    try {
      const nextDashboard = await fetchAdminJson<ProductFeedbackAdminDashboard>(
        "/api/melhorias/admin/items",
        {
          method: "POST",
          body: JSON.stringify({
            action: "create",
            title: newTitle,
            summary: newSummary,
            publicNote: newPublicNote || null,
            area: newArea,
            status: newStatus,
          }),
        }
      );
      setDashboard(nextDashboard);
      setNewTitle("");
      setNewSummary("");
      setNewPublicNote("");
      setNewArea("Geral");
      setNewStatus("backlog");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao criar item.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Moderacao
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Melhorias &amp; Prioridades Admin
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Moderacao de fila, consolidacao de ideias e curadoria editorial do backlog publico.
          </p>
        </div>
        <Link
          href="/melhorias"
          className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao hub
        </Link>
      </div>

      {!session && !authLoading ? (
        <section className="rounded-[1.75rem] border border-border/70 bg-background/80 p-6 backdrop-blur">
          <p className="text-sm leading-6 text-muted-foreground">
            Entre com uma conta autorizada para acessar a moderacao.
          </p>
          <Button
            type="button"
            variant="premium"
            className="mt-4 rounded-full"
            onClick={() => setAuthDialogOpen(true)}
          >
            Entrar
          </Button>
        </section>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Carregando moderacao...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[1.5rem] border border-red-200/80 bg-red-50/80 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {session && dashboard ? (
        <>
          <section className="rounded-[1.75rem] border border-border/70 bg-background/80 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold text-foreground">Criar item manual</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use quando o time quiser abrir uma prioridade publica sem depender de uma submissao previa.
            </p>
            <div className="mt-4 grid gap-3">
              <Input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Titulo do item"
              />
              <textarea
                value={newSummary}
                onChange={(event) => setNewSummary(event.target.value)}
                rows={4}
                className="min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                placeholder="Resumo curto"
              />
              <textarea
                value={newPublicNote}
                onChange={(event) => setNewPublicNote(event.target.value)}
                rows={3}
                className="min-h-24 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                placeholder="Nota publica opcional"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  value={newArea}
                  onValueChange={(value) => setNewArea(value as ProductFeedbackArea)}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_FEEDBACK_AREAS.map((area) => (
                      <SelectItem key={area} value={area}>
                        {PRODUCT_FEEDBACK_AREA_LABEL[area]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={newStatus}
                  onValueChange={(value) => setNewStatus(value as ProductFeedbackStatus)}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="launched">Lancada</SelectItem>
                    <SelectItem value="archived">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="premium"
                className="w-fit rounded-full"
                disabled={!newTitle.trim() || !newSummary.trim() || creating}
                onClick={() => void createManualItem()}
              >
                {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Criar item
              </Button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Fila de moderacao
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {dashboard.pendingSubmissions.length} sugestoes aguardando triagem.
                </p>
              </div>
            </div>
            {dashboard.pendingSubmissions.length > 0 ? (
              <div className="grid gap-4">
                {dashboard.pendingSubmissions.map((entry) => (
                  <QueueCard
                    key={entry.id}
                    entry={entry}
                    items={dashboard.items}
                    onDashboardChange={setDashboard}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-border bg-background/72 p-6 text-sm text-muted-foreground">
                Nenhuma submissao pendente no momento.
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Itens publicos</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Edite copia, status, ranking e fusoes sem sair da interface.
              </p>
            </div>
            <div className="grid gap-4">
              {dashboard.items
                .filter((item) => !item.mergedIntoItemId)
                .map((item) => (
                  <EditableItemCard
                    key={item.id}
                    item={item}
                    items={dashboard.items}
                    onDashboardChange={setDashboard}
                  />
                ))}
            </div>
          </section>
        </>
      ) : null}

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
      />
    </main>
  );
}
