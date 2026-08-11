"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Source = {
  id: string; authority: string; competition: string; rollout_status: string;
  freshness_hours: number; last_successful_at: string | null; last_error: string | null;
};
type Run = { id: string; trigger_kind: string; status: string; started_at: string; finished_at: string | null; summary: Record<string, number> };
type Release = { id: string; version: number; release_kind: string; published_at: string };
type Candidate = { id: string; source_id: string; status: string; diff: { added?: string[]; changed?: string[]; removed?: string[] }; validation_issues: Array<{ message: string }> };
type AdminData = { sources: Source[]; runs: Run[]; releases: Release[]; candidates: Candidate[]; currentReleaseId: string | null };

const dateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "Nunca";

export function CalendarPacksAdmin() {
  const [data, setData] = React.useState<AdminData | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = React.useState("Correção administrativa");

  const load = React.useCallback(async () => {
    const response = await fetch("/api/internal/calendar-packs/admin", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar o painel.");
    setData(payload);
  }, []);
  React.useEffect(() => { void load().catch((cause) => setError(cause.message)); }, [load]);

  const refresh = async () => {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/internal/calendar-packs/refresh", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha na atualização.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha na atualização."); }
    finally { setBusy(false); }
  };

  const rollback = async (releaseId: string) => {
    if (!window.confirm("Publicar novamente este release anterior?")) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/internal/calendar-packs/rollback", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ releaseId, reason: rollbackReason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha no rollback.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha no rollback."); }
    finally { setBusy(false); }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-8 p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm text-muted-foreground">Operação Doze 52</p><h1 className="text-2xl font-semibold">Calendários dinâmicos</h1></div>
        <Button onClick={() => void refresh()} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} />Atualizar agora</Button>
      </header>
      {error && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</div>}

      <section className="space-y-3"><h2 className="text-lg font-medium">Fontes</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {data?.sources.map((source) => {
            const stale = !source.last_successful_at || Date.now() - new Date(source.last_successful_at).getTime() > source.freshness_hours * 3_600_000;
            return <article key={source.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{source.competition}</p><p className="text-sm text-muted-foreground">{source.authority} · {source.rollout_status}</p></div>{stale ? <AlertTriangle className="text-amber-500" /> : <CheckCircle2 className="text-emerald-500" />}</div>
              <p className="mt-3 text-sm"><Clock3 className="mr-1 inline size-4" />Último sucesso: {dateTime(source.last_successful_at)}</p>
              {source.last_error && <p className="mt-2 text-sm text-destructive">{source.last_error}</p>}
            </article>;
          })}
        </div>
      </section>

      <section className="space-y-3"><h2 className="text-lg font-medium">Execuções recentes</h2>
        <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted/50"><tr><th className="p-3">Início</th><th className="p-3">Gatilho</th><th className="p-3">Status</th><th className="p-3">Resumo</th></tr></thead><tbody>{data?.runs.map((run) => <tr key={run.id} className="border-t"><td className="p-3">{dateTime(run.started_at)}</td><td className="p-3">{run.trigger_kind}</td><td className="p-3">{run.status}</td><td className="p-3">{Object.entries(run.summary ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ")}</td></tr>)}</tbody></table></div>
      </section>

      <section className="space-y-3"><h2 className="text-lg font-medium">Diferenças e quarentena</h2>
        <div className="space-y-2">{data?.candidates.filter((candidate) => candidate.status !== "unchanged").slice(0, 20).map((candidate) => <article key={candidate.id} className="rounded-xl border p-3 text-sm"><p className="font-medium">{candidate.source_id} · {candidate.status}</p><p className="text-muted-foreground">+{candidate.diff.added?.length ?? 0} · ~{candidate.diff.changed?.length ?? 0} · −{candidate.diff.removed?.length ?? 0}</p>{candidate.validation_issues.map((issue, index) => <p className="text-destructive" key={index}>{issue.message}</p>)}</article>)}</div>
      </section>

      <section className="space-y-3"><h2 className="text-lg font-medium">Releases e rollback</h2>
        <Input value={rollbackReason} onChange={(event) => setRollbackReason(event.target.value)} aria-label="Justificativa do rollback" />
        <div className="space-y-2">{data?.releases.map((release) => <div key={release.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-medium">Release {release.version}{release.id === data.currentReleaseId ? " · atual" : ""}</p><p className="text-sm text-muted-foreground">{release.release_kind} · {dateTime(release.published_at)}</p></div>{release.id !== data.currentReleaseId && <Button variant="outline" size="sm" disabled={busy || rollbackReason.trim().length < 3} onClick={() => void rollback(release.id)}><RotateCcw />Rollback</Button>}</div>)}</div>
      </section>
    </main>
  );
}
