import { expect, test } from "@playwright/test";

import {
  buildImportPlan,
  createStructureResolution,
  getCategoryOptionsForContext,
  IMPORT_LIMITS,
  type StructureResolution,
} from "@/lib/calendar-import";
import {
  CANONICAL_SPREADSHEET_HEADERS,
  createCalendarSpreadsheetBuffer,
  getCanonicalImportMapping,
  isCanonicalSpreadsheetSource,
  readSpreadsheetSource,
  suggestImportMapping,
  type ImportColumnMapping,
  type SpreadsheetSource,
} from "@/lib/calendar-spreadsheet";
import type { CalendarSnapshot } from "@/lib/sync";
import { createXlsx, readXlsxSheet } from "@/lib/xlsx-lite";

const snapshot: CalendarSnapshot = {
  profiles: [
    {
      id: "44444444-4444-4444-8444-444444444441",
      name: "Profissional",
      color: "#64748B",
      icon: "briefcase",
      position: 0,
    },
  ],
  categories: [
    {
      id: "55555555-5555-4555-8555-555555555552",
      profileId: "44444444-4444-4444-8444-444444444441",
      name: "Entregas",
      color: "#7C3AED",
      visible: true,
    },
    {
      id: "55555555-5555-4555-8555-555555555553",
      profileId: "44444444-4444-4444-8444-444444444441",
      name: "Feriados",
      color: "#EF4444",
      visible: true,
      calendarPackGroupId: "pack-brasil",
    },
  ],
  events: [
    {
      id: "77777777-7777-4777-8777-777777777777",
      title: "Release existente",
      categoryId: "55555555-5555-4555-8555-555555555552",
      color: "#7C3AED",
      startDate: "2026-09-10",
      endDate: "2026-09-10",
      createdAt: "2026-08-03T12:00:00.000Z",
      dayOrder: 0,
    },
  ],
};

const canonicalSource = (rows: string[][]): SpreadsheetSource => ({
  sheetNames: ["Eventos"],
  selectedSheetName: "Eventos",
  headers: [...CANONICAL_SPREADSHEET_HEADERS],
  rows: rows.map((values, index) => ({ rowNumber: index + 2, values })),
});

const planCanonical = (
  source: SpreadsheetSource,
  target: CalendarSnapshot = snapshot,
  resolution?: StructureResolution
) => {
  const mapping = getCanonicalImportMapping();
  const resolved = resolution ?? createStructureResolution(source, mapping, target);
  return buildImportPlan(source, mapping, resolved, target);
};

test("faz round-trip do formato canonico com datas nativas do Excel", () => {
  const sourceSnapshot: CalendarSnapshot = {
    profiles: snapshot.profiles,
    categories: snapshot.categories.slice(0, 1),
    events: [
      {
        ...snapshot.events[0],
        title: "Marco Jira",
        startDate: "2026-12-04",
        endDate: "2026-12-04",
        notes: "JIRA-252",
      },
      {
        ...snapshot.events[0],
        id: "77777777-7777-4777-8777-777777777778",
        title: "Iniciativa anual",
        startDate: "2026-10-01",
        endDate: "2026-12-18",
      },
    ],
  };
  const source = readSpreadsheetSource(
    createCalendarSpreadsheetBuffer(sourceSnapshot).slice().buffer,
    "Eventos"
  );
  const empty: CalendarSnapshot = { profiles: [], categories: [], events: [] };
  const plan = planCanonical(source, empty);

  expect(isCanonicalSpreadsheetSource(source)).toBe(true);
  expect(plan.blockingErrors).toEqual([]);
  expect(plan.snapshot.profiles.map((item) => item.name)).toEqual(["Profissional"]);
  expect(plan.snapshot.categories.map((item) => item.name)).toEqual(["Entregas"]);
  expect(plan.snapshot.events.map(({ title, startDate, endDate, notes }) => ({ title, startDate, endDate, notes }))).toEqual([
    { title: "Marco Jira", startDate: "2026-12-04", endDate: "2026-12-04", notes: "JIRA-252" },
    { title: "Iniciativa anual", startDate: "2026-10-01", endDate: "2026-12-18", notes: undefined },
  ]);
});

test("exporta todos os eventos quando nenhum recorte e informado", () => {
  const source = readSpreadsheetSource(
    createCalendarSpreadsheetBuffer(snapshot).slice().buffer,
    "Eventos"
  );

  expect(source.rows.map((row) => row.values.slice(0, 3))).toEqual([
    ["Profissional", "Entregas", "Release existente"],
  ]);
});

test("filtra a exportacao por contexto e categoria, incluindo calendarios gerenciados", () => {
  const personalProfile = {
    ...snapshot.profiles[0],
    id: "44444444-4444-4444-8444-444444444443",
    name: "Pessoal",
  };
  const managedEvent = {
    ...snapshot.events[0],
    id: "77777777-7777-4777-8777-777777777779",
    title: "Feriado exportado",
    categoryId: snapshot.categories[1].id,
  };
  const personalCategory = {
    ...snapshot.categories[0],
    id: "55555555-5555-4555-8555-555555555554",
    profileId: personalProfile.id,
    name: "Viagens",
  };
  const personalEvent = {
    ...snapshot.events[0],
    id: "77777777-7777-4777-8777-777777777780",
    title: "Ferias",
    categoryId: personalCategory.id,
  };
  const sourceSnapshot: CalendarSnapshot = {
    profiles: [...snapshot.profiles, personalProfile],
    categories: [...snapshot.categories, personalCategory],
    events: [...snapshot.events, managedEvent, personalEvent],
  };
  const source = readSpreadsheetSource(
    createCalendarSpreadsheetBuffer(sourceSnapshot, {
      profileIds: [snapshot.profiles[0].id],
      categoryIds: [snapshot.categories[1].id],
    }).slice().buffer,
    "Eventos"
  );

  expect(source.rows.map((row) => row.values.slice(0, 3))).toEqual([
    ["Profissional", "Feriados", "Feriado exportado"],
  ]);
});

test("gera apenas o cabecalho quando o recorte de exportacao esta vazio", () => {
  const workbook = createCalendarSpreadsheetBuffer(snapshot, {
    profileIds: [],
    categoryIds: [],
  });
  const rows = readXlsxSheet(workbook.slice().buffer, "Eventos");

  expect(rows).toHaveLength(1);
  expect([...rows[0].cells.values()]).toEqual([...CANONICAL_SPREADSHEET_HEADERS]);
});

test("template cria estruturas ausentes e assume data final igual a inicial", () => {
  const source = canonicalSource([
    ["Produto", "Time Azul", "Epico A", "2026-10-01", "2026-10-20", ""],
    ["Produto", "Time Azul", "Marco", "2026-11-03", "", ""],
  ]);
  const plan = planCanonical(source, { profiles: [], categories: [], events: [] });

  expect(plan.blockingErrors).toEqual([]);
  expect(plan.summary).toMatchObject({ createdContexts: 1, createdCategories: 1, importedEvents: 2 });
  expect(plan.snapshot.events[1]).toMatchObject({ startDate: "2026-11-03", endDate: "2026-11-03" });
});

test("mapeia aba e colunas arbitrarias com categoria fixa", () => {
  const workbook = createXlsx([
    { name: "Leia-me", rows: [["Texto"], ["Ignore"]], widths: [24] },
    {
      name: "Jira",
      rows: [
        ["Project", "Summary", "Start date", "Due date", "Description"],
        ["Roadmap", "Epico 252", "2026-10-01", "2026-12-01", "JIRA-252"],
      ],
      widths: [20, 30, 16, 16, 30],
    },
  ]);
  const source = readSpreadsheetSource(workbook.slice().buffer, "Jira");
  const suggested = suggestImportMapping(source);
  const mapping: ImportColumnMapping = {
    ...suggested,
    category: { kind: "fixed", value: "Geral" },
  };
  const empty: CalendarSnapshot = { profiles: [], categories: [], events: [] };
  const resolution = createStructureResolution(source, mapping, empty);
  const plan = buildImportPlan(source, mapping, resolution, empty);

  expect(source.sheetNames).toEqual(["Leia-me", "Jira"]);
  expect(suggested).toMatchObject({ eventColumn: 1, startDateColumn: 2, endDateColumn: 3, notesColumn: 4 });
  expect(plan.snapshot.categories[0].name).toBe("Geral");
  expect(plan.snapshot.events[0]).toMatchObject({ title: "Epico 252", notes: "JIRA-252" });
});

test("normaliza nomes, permite remapear e ignora estruturas escolhidas", () => {
  const source = canonicalSource([
    [" PROFISSIONÁL ", "entregas", "Epico", "2026-10-01", "", ""],
    ["Outro", "Descartar", "Nao importar", "2026-10-02", "", ""],
  ]);
  const mapping = getCanonicalImportMapping();
  let resolution = createStructureResolution(source, mapping, snapshot);
  const other = resolution.contexts.find((item) => item.sourceValue === "Outro")!;
  resolution = {
    ...resolution,
    contexts: resolution.contexts.map((item) =>
      item.key === other.key ? { ...item, action: "ignore", targetId: undefined } : item
    ),
  };
  resolution = createStructureResolution(source, mapping, snapshot, resolution);
  const plan = buildImportPlan(source, mapping, resolution, snapshot);

  expect(resolution.contexts[0]).toMatchObject({ action: "existing", targetId: snapshot.profiles[0].id });
  expect(plan.summary).toMatchObject({ importedEvents: 1, ignoredRows: 1, createdContexts: 0 });
});

test("detecta ambiguidade e impede categoria gerenciada como destino", () => {
  const ambiguous: CalendarSnapshot = {
    ...snapshot,
    profiles: [...snapshot.profiles, { ...snapshot.profiles[0], id: "44444444-4444-4444-8444-444444444442" }],
  };
  const source = canonicalSource([["Profissional", "Entregas", "Epico", "2026-10-01", "", ""]]);
  const ambiguousPlan = planCanonical(source, ambiguous);
  expect(ambiguousPlan.blockingErrors.join(" ")).toContain("contexto ambiguo");

  const mapping = getCanonicalImportMapping();
  const resolution = createStructureResolution(source, mapping, snapshot);
  const context = resolution.contexts[0];
  expect(getCategoryOptionsForContext(context, snapshot).map((item) => item.name)).toEqual(["Entregas"]);
  resolution.categories[0] = {
    ...resolution.categories[0],
    action: "existing",
    targetId: snapshot.categories[1].id,
  };
  const managedPlan = buildImportPlan(source, mapping, resolution, snapshot);
  expect(managedPlan.issues.map((item) => item.message).join(" ")).toContain("calendario gerenciado");
});

test("deduplica existentes e repetidos no arquivo", () => {
  const source = canonicalSource([
    ["Profissional", "Entregas", "Release existente", "2026-09-10", "", ""],
    ["Profissional", "Entregas", "Novo", "2026-10-01", "", ""],
    ["Profissional", "Entregas", "NOVO", "2026-10-01", "2026-10-01", ""],
  ]);
  const plan = planCanonical(source);

  expect(plan.summary).toMatchObject({ importedEvents: 1, duplicateRows: 2 });
  expect(plan.duplicateRows).toEqual([2, 4]);
});

test("descarta datas e titulos invalidos sem bloquear linhas validas", () => {
  const source = canonicalSource([
    ["Profissional", "Entregas", "", "2026-10-01", "", ""],
    ["Profissional", "Entregas", "Fim errado", "2026-10-10", "2026-10-01", ""],
    ["Profissional", "Entregas", "Data serial", "46360", "", ""],
  ]);
  const plan = planCanonical(source);

  expect(plan.blockingErrors).toEqual([]);
  expect(plan.summary).toMatchObject({ invalidRows: 2, importedEvents: 1 });
  expect(plan.snapshot.events.at(-1)).toMatchObject({ startDate: "2026-12-04", endDate: "2026-12-04" });
});

test("bloqueia exatamente quando excede os limites de criacao e eventos", () => {
  const contexts = canonicalSource(
    Array.from({ length: IMPORT_LIMITS.maxNewContexts + 1 }, (_, index) => [
      `Contexto ${index}`,
      "Geral",
      `Evento ${index}`,
      "2026-10-01",
      "",
      "",
    ])
  );
  expect(planCanonical(contexts, { profiles: [], categories: [], events: [] }).blockingErrors.join(" ")).toContain("11 contextos");

  const categories = canonicalSource(
    Array.from({ length: IMPORT_LIMITS.maxNewCategories + 1 }, (_, index) => [
      "Contexto",
      `Categoria ${index}`,
      `Evento ${index}`,
      "2026-10-01",
      "",
      "",
    ])
  );
  expect(planCanonical(categories, { profiles: [], categories: [], events: [] }).blockingErrors.join(" ")).toContain("51 categorias");

  const events = canonicalSource(
    Array.from({ length: IMPORT_LIMITS.maxEvents + 1 }, (_, index) => [
      "Contexto",
      "Geral",
      `Evento ${index}`,
      "2026-10-01",
      "",
      "",
    ])
  );
  expect(planCanonical(events, { profiles: [], categories: [], events: [] }).blockingErrors.join(" ")).toContain("1.001 eventos");
});

test("planejar nao altera o estado e produz um unico snapshot coerente", () => {
  const original = structuredClone(snapshot);
  const source = canonicalSource([["Novo contexto", "Geral", "Marco", "2026-12-01", "", ""]]);
  const plan = planCanonical(source);

  expect(snapshot).toEqual(original);
  expect(plan.snapshot.profiles).toHaveLength(snapshot.profiles.length + 1);
  expect(plan.snapshot.categories).toHaveLength(snapshot.categories.length + 1);
  expect(plan.snapshot.events).toHaveLength(snapshot.events.length + 1);
  expect(plan.snapshot.events.at(-1)?.categoryId).toBe(plan.snapshot.categories.at(-1)?.id);
});
