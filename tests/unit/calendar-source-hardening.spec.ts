import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

import { fetchGeFootballFeed } from "../../lib/calendar-catalog/ge-feed";
import {
  CalendarSourceBudget,
  fetchBoundedCalendarSource,
} from "../../lib/calendar-catalog/source-transport";
import type { CalendarCatalogSource } from "../../lib/calendar-catalog/types";

const source: CalendarCatalogSource = {
  id: "cbf-brasileirao-2026",
  authority: "CBF",
  competition: "Campeonato Brasileiro Serie A",
  season: 2026,
  official_url: "https://www.cbf.com.br/fonte",
  parser_key: "cbf",
  feed_provider: "GE",
  feed_url: "https://ge.globo.com/tabela",
  rollout_status: "shadow",
  freshness_hours: 28,
  last_checked_at: null,
  last_successful_at: null,
  last_error: null,
};

test("recusa host não autorizado antes de iniciar a requisição", async () => {
  let called = false;
  const budget = new CalendarSourceBudget();

  await expect(
    fetchBoundedCalendarSource({
      sourceId: source.id,
      input: "https://attacker.invalid/payload",
      allowedHosts: new Set(["ge.globo.com"]),
      acceptedContentTypes: ["text/html"],
      maxBytes: 16,
      budget,
      fetchImpl: (async () => {
        called = true;
        return new Response("never");
      }) as typeof fetch,
    })
  ).rejects.toMatchObject({ code: "source_url_not_allowed" });

  expect(called).toBe(false);
  expect(budget.snapshot()[source.id]).toMatchObject({
    requests: 0,
    failures: { source_url_not_allowed: 1 },
  });
});

test("interrompe resposta chunked ao ultrapassar o teto e registra métricas sanitizadas", async () => {
  let canceled = false;
  const budget = new CalendarSourceBudget();
  const fetchImpl = (async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(17));
        },
        cancel() {
          canceled = true;
        },
      }),
      { status: 200, headers: { "content-type": "text/html" } }
    )) as typeof fetch;

  await expect(
    fetchBoundedCalendarSource({
      sourceId: source.id,
      input: source.feed_url!,
      allowedHosts: new Set(["ge.globo.com"]),
      acceptedContentTypes: ["text/html"],
      maxBytes: 16,
      budget,
      fetchImpl,
    })
  ).rejects.toMatchObject({ code: "source_response_too_large" });

  expect(canceled).toBe(true);
  expect(budget.snapshot()[source.id]).toMatchObject({
    requests: 1,
    bytes: 17,
    statusClasses: { "2xx": 1 },
    failures: { source_response_too_large: 1 },
  });
});

test("preserva uma resposta legítima e contabiliza bytes sem guardar conteúdo", async () => {
  const budget = new CalendarSourceBudget();
  const result = await fetchBoundedCalendarSource({
    sourceId: source.id,
    input: source.feed_url!,
    allowedHosts: new Set(["ge.globo.com"]),
    acceptedContentTypes: ["text/html"],
    maxBytes: 32,
    budget,
    fetchImpl: (async () =>
      new Response("conteudo valido", {
        headers: { "content-type": "text/html; charset=utf-8" },
      })) as typeof fetch,
  });

  expect(result.body).toBe("conteudo valido");
  const metrics = budget.snapshot()[source.id];
  expect(metrics).toMatchObject({ requests: 1, bytes: 15, failures: {} });
  expect(JSON.stringify(metrics)).not.toContain("conteudo valido");
});

test("impõe orçamento por fonte e por execução antes de novas chamadas", () => {
  const sourceBudget = new CalendarSourceBudget();
  for (let index = 0; index < 100; index += 1) {
    sourceBudget.beginRequest("source-a");
  }
  expect(() => sourceBudget.beginRequest("source-a")).toThrow(
    "source_request_budget_exceeded"
  );

  const runBudget = new CalendarSourceBudget();
  for (const sourceId of ["source-a", "source-b", "source-c"]) {
    for (let index = 0; index < 100; index += 1) {
      runBudget.beginRequest(sourceId);
    }
  }
  expect(() => runBudget.beginRequest("source-d")).toThrow(
    "source_request_budget_exceeded"
  );
});

test("limita fases controladas pelo bootstrap antes de ampliar requisições", async () => {
  const phases = Array.from({ length: 17 }, (_, index) => ({
    nome: `Fase ${index}`,
    slug: `fase-${index}`,
  }));
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(
      `<script>const classificacao = ${JSON.stringify({
        fase: phases[0],
        fases_navegacao: phases,
      })}; const resource = { tUUID: "table-1" };</script>`,
      { headers: { "content-type": "text/html" } }
    );
  }) as typeof fetch;

  await expect(fetchGeFootballFeed(source, fetchImpl)).rejects.toMatchObject({
    code: "source_phase_limit_exceeded",
  });
  expect(calls).toBe(1);
});

test("migração mantém o lease privado, transacional e service-role-only", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260824185214_harden_calendar_source_refresh.sql"
    ),
    "utf8"
  );

  expect(sql).toContain("for update;");
  expect(sql).toContain("interval '330 seconds'");
  expect(sql.match(/security invoker/g)).toHaveLength(3);
  expect(sql).toContain("force row level security");
  expect(sql).toContain("from public, anon, authenticated");
  expect(sql).toContain("to service_role;");
  expect(sql).toContain("'outcome', 'in_progress'");
});
