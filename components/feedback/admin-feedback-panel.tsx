"use client";

import * as React from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { FeedbackRow } from "@/lib/feedback-server";
import {
  feedbackKindLabels,
  feedbackStatusLabels,
  type FeedbackStatus,
} from "@/lib/product-feedback";

type Filters = { status: string; kind: string; period: string };

export function AdminFeedbackPanel() {
  const [filters, setFilters] = React.useState<Filters>({ status: "all", kind: "all", period: "30d" });
  const [items, setItems] = React.useState<FeedbackRow[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const load = React.useCallback(async (append = false, cursor?: string | null) => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.kind !== "all") params.set("kind", filters.kind);
    if (filters.period !== "all") params.set("period", filters.period);
    if (append && cursor) params.set("cursor", cursor);
    try {
      const response = await fetch(`/api/admin/feedback?${params.toString()}`);
      const result = (await response.json()) as { items?: FeedbackRow[]; nextCursor?: string | null; error?: string };
      if (!response.ok || !result.items) throw new Error(result.error ?? "Falha ao carregar.");
      setItems((current) => append ? [...current, ...result.items!] : result.items!);
      setNextCursor(result.nextCursor ?? null);
      if (!append) setSelectedId(result.items[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar.");
    } finally { setLoading(false); }
  }, [filters]);

  React.useEffect(() => { void load(); }, [load]);

  const updateSelected = async (status: FeedbackStatus, internalNote: string) => {
    if (!selected || saving) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/admin/feedback/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, internalNote }),
      });
      const result = (await response.json()) as { item?: FeedbackRow; error?: string };
      if (!response.ok || !result.item) throw new Error(result.error ?? "Falha ao salvar.");
      setItems((current) => current.map((item) => item.id === result.item!.id ? result.item! : item));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar.");
    } finally { setSaving(false); }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Voltar ao calendário</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Feedback do produto</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fila privada de triagem.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterSelect label="Estado" value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status }))} options={[["all", "Todos"], ...Object.entries(feedbackStatusLabels)]} />
          <FilterSelect label="Tipo" value={filters.kind} onChange={(kind) => setFilters((current) => ({ ...current, kind }))} options={[["all", "Todos"], ...Object.entries(feedbackKindLabels)]} />
          <FilterSelect label="Período" value={filters.period} onChange={(period) => setFilters((current) => ({ ...current, period }))} options={[["7d", "7 dias"], ["30d", "30 dias"], ["all", "Todo o período"]]} />
        </div>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      <div className="grid min-h-[34rem] overflow-hidden rounded-2xl border border-border/80 bg-card lg:grid-cols-[22rem_1fr]">
        <section className="border-b border-border/80 lg:border-r lg:border-b-0">
          {loading && items.length === 0 ? <div className="grid h-52 place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div> : items.length === 0 ? <div className="grid h-52 place-items-center px-6 text-center text-sm text-muted-foreground">Nenhum feedback neste filtro.</div> : (
            <div className="max-h-[70vh] overflow-y-auto">
              {items.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full border-b border-border/60 p-4 text-left transition hover:bg-muted/50 ${selectedId === item.id ? "bg-muted/70" : ""}`}>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{feedbackKindLabels[item.kind]}</span><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</span></div>
                <p className="mt-2 line-clamp-2 text-sm leading-5">{item.message}</p>
                <span className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">{feedbackStatusLabels[item.status]}</span>
              </button>)}
              {nextCursor ? <Button variant="ghost" className="m-3 w-[calc(100%-1.5rem)]" disabled={loading} onClick={() => void load(true, nextCursor)}>{loading ? "Carregando..." : "Carregar mais"}</Button> : null}
            </div>
          )}
        </section>
        <section className="p-5 sm:p-7">{selected ? <FeedbackDetail item={selected} saving={saving} onSave={updateSelected} /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">Selecione um feedback.</div>}</section>
      </div>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function FeedbackDetail({ item, saving, onSave }: { item: FeedbackRow; saving: boolean; onSave: (status: FeedbackStatus, note: string) => Promise<void> }) {
  const [status, setStatus] = React.useState<FeedbackStatus>(item.status);
  const [note, setNote] = React.useState(item.internal_note ?? "");
  React.useEffect(() => { setStatus(item.status); setNote(item.internal_note ?? ""); }, [item.id, item.status, item.internal_note]);
  const context = item.technical_context;
  return <div className="space-y-6">
    <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{feedbackKindLabels[item.kind]}</span><span className="text-xs text-muted-foreground">{item.id.slice(0, 8).toUpperCase()}</span></div><p className="mt-4 whitespace-pre-wrap text-base leading-7">{item.message}</p></div>
    <dl className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm sm:grid-cols-2"><Detail label="Rota" value={String(context.route ?? "-")} /><Detail label="Dispositivo" value={String(context.deviceClass ?? "-")} /><Detail label="Onboarding" value={String(context.onboardingStep ?? "-")} /><Detail label="Versão" value={String(context.appVersion ?? "-").slice(0, 12)} /><Detail label="Contato autorizado" value={item.contact_consent ? "Sim" : "Não"} /><Detail label="E-mail" value={item.contact_email ?? "Não armazenado"} /></dl>
    <label className="block space-y-2 text-sm font-medium">Estado<select value={status} onChange={(event) => setStatus(event.target.value as FeedbackStatus)} className="block h-9 w-full rounded-md border border-input bg-background px-3 font-normal sm:w-52">{(Object.keys(feedbackStatusLabels) as FeedbackStatus[]).map((value) => <option key={value} value={value}>{feedbackStatusLabels[value]}</option>)}</select></label>
    <div className="space-y-2"><div className="flex justify-between"><label htmlFor="internal-note" className="text-sm font-medium">Nota interna</label><span className="text-xs text-muted-foreground">{note.length}/4000</span></div><textarea id="internal-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} rows={6} className="w-full resize-y rounded-xl border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" /></div>
    <Button disabled={saving} onClick={() => void onSave(status, note)}>{saving ? "Salvando..." : "Salvar triagem"}</Button>
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>; }
