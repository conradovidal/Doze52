import type { CalendarSnapshot } from "@/lib/sync";
import { createXlsx, listXlsxSheets, readXlsxSheet, type XlsxCell } from "@/lib/xlsx-lite";

const EVENTS_SHEET_NAME = "Eventos";
const INSTRUCTIONS_SHEET_NAME = "Instrucoes";

export const CANONICAL_SPREADSHEET_HEADERS = [
  "contexto",
  "categoria",
  "evento",
  "data_inicial",
  "data_final",
  "notas",
] as const;

export type SpreadsheetSourceRow = {
  rowNumber: number;
  values: string[];
};

export type SpreadsheetSource = {
  sheetNames: string[];
  selectedSheetName: string;
  headers: string[];
  rows: SpreadsheetSourceRow[];
};

export type CalendarSpreadsheetExportSelection = {
  profileIds: string[];
  categoryIds: string[];
};

export type ColumnOrFixedMapping =
  | { kind: "column"; columnIndex: number }
  | { kind: "fixed"; value: string };

export type ImportColumnMapping = {
  context: ColumnOrFixedMapping;
  category: ColumnOrFixedMapping;
  eventColumn: number | null;
  startDateColumn: number | null;
  endDateColumn: number | null;
  notesColumn: number | null;
};

const normalizeLookupValue = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

export const normalizeSpreadsheetHeader = (value: string) =>
  normalizeLookupValue(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const cellText = (row: Map<number, string>, columnCount: number) =>
  Array.from({ length: columnCount }, (_, index) => row.get(index + 1)?.trim() ?? "");

export const readSpreadsheetSource = (
  file: ArrayBuffer,
  requestedSheetName?: string
): SpreadsheetSource => {
  const sheetNames = listXlsxSheets(file);
  if (sheetNames.length === 0) {
    throw new Error("A planilha nao possui abas legiveis.");
  }
  const selectedSheetName = requestedSheetName ?? sheetNames[0];
  if (!sheetNames.includes(selectedSheetName)) {
    throw new Error("A aba selecionada nao existe mais no arquivo.");
  }
  const worksheetRows = readXlsxSheet(file, selectedSheetName);
  const headerRow = worksheetRows.find((row) => row.rowNumber === 1);
  if (!headerRow) {
    throw new Error("A primeira linha da aba precisa conter os cabecalhos.");
  }
  const maxColumn = Math.max(0, ...headerRow.cells.keys());
  const headers = cellText(headerRow.cells, maxColumn);
  if (headers.every((header) => !header)) {
    throw new Error("A primeira linha da aba nao possui cabecalhos preenchidos.");
  }
  const rows = worksheetRows
    .filter((row) => row.rowNumber >= 2)
    .map((row) => ({
      rowNumber: row.rowNumber,
      values: cellText(row.cells, headers.length),
    }))
    .filter((row) => row.values.some(Boolean));
  if (rows.length === 0) {
    throw new Error("A aba selecionada nao possui linhas preenchidas.");
  }
  return { sheetNames, selectedSheetName, headers, rows };
};

const HEADER_ALIASES: Record<keyof Omit<ImportColumnMapping, "context" | "category">, string[]> = {
  eventColumn: ["evento", "event", "summary", "epic_name", "initiative_name", "titulo", "title"],
  startDateColumn: ["data_inicial", "start_date", "start", "inicio", "initial_date"],
  endDateColumn: ["data_final", "due_date", "end_date", "end", "fim"],
  notesColumn: ["notas", "notes", "description", "descricao", "key", "issue_key"],
};

const CONTEXT_ALIASES = ["contexto", "perfil_contexto", "project", "projeto", "portfolio"];
const CATEGORY_ALIASES = ["categoria", "category", "team", "time", "squad"];

const findHeaderIndex = (headers: string[], aliases: string[]) => {
  const normalized = headers.map(normalizeSpreadsheetHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index >= 0) return index;
  }
  return null;
};

export const suggestImportMapping = (source: SpreadsheetSource): ImportColumnMapping => ({
  context: {
    kind: "column",
    columnIndex: findHeaderIndex(source.headers, CONTEXT_ALIASES) ?? 0,
  },
  category: (() => {
    const columnIndex = findHeaderIndex(source.headers, CATEGORY_ALIASES);
    return columnIndex === null
      ? { kind: "fixed" as const, value: "Geral" }
      : { kind: "column" as const, columnIndex };
  })(),
  eventColumn: findHeaderIndex(source.headers, HEADER_ALIASES.eventColumn),
  startDateColumn: findHeaderIndex(source.headers, HEADER_ALIASES.startDateColumn),
  endDateColumn: findHeaderIndex(source.headers, HEADER_ALIASES.endDateColumn),
  notesColumn: findHeaderIndex(source.headers, HEADER_ALIASES.notesColumn),
});

export const isCanonicalSpreadsheetSource = (source: SpreadsheetSource) =>
  CANONICAL_SPREADSHEET_HEADERS.every(
    (header, index) => normalizeSpreadsheetHeader(source.headers[index] ?? "") === header
  );

export const getCanonicalImportMapping = (): ImportColumnMapping => ({
  context: { kind: "column", columnIndex: 0 },
  category: { kind: "column", columnIndex: 1 },
  eventColumn: 2,
  startDateColumn: 3,
  endDateColumn: 4,
  notesColumn: 5,
});

const isoDateToDate = (value: string) => {
  const match = value.match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? new Date(value + "T00:00:00.000Z") : value;
};

const getExportRows = (
  snapshot?: CalendarSnapshot,
  selection?: CalendarSpreadsheetExportSelection
): XlsxCell[][] => {
  const rows: XlsxCell[][] = [[...CANONICAL_SPREADSHEET_HEADERS]];
  if (!snapshot) return rows;
  const selectedProfileIds = selection ? new Set(selection.profileIds) : null;
  const selectedCategoryIds = selection ? new Set(selection.categoryIds) : null;
  const profilesById = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
  const categoriesById = new Map(snapshot.categories.map((category) => [category.id, category]));
  for (const event of snapshot.events) {
    const category = categoriesById.get(event.categoryId);
    const profile = category ? profilesById.get(category.profileId) : undefined;
    if (!profile || !category) continue;
    if (
      selectedProfileIds &&
      selectedCategoryIds &&
      (!selectedProfileIds.has(profile.id) || !selectedCategoryIds.has(category.id))
    ) {
      continue;
    }
    rows.push([
      profile.name,
      category.name,
      event.title,
      isoDateToDate(event.startDate),
      isoDateToDate(event.endDate),
      event.notes ?? "",
    ]);
  }
  return rows;
};

const INSTRUCTION_ROWS: XlsxCell[][] = [
  ["Campo", "Regra"],
  ["contexto", "Perfil do Doze52. No Jira, normalmente corresponde ao projeto."],
  ["categoria", "Categoria dentro do contexto. Pode representar time, squad ou campo customizado."],
  ["evento", "Nome do periodo. Pode representar epico, iniciativa ou outro nivel exportado."],
  ["data_inicial", "Data obrigatoria. Use uma celula de data do Excel ou AAAA-MM-DD."],
  ["data_final", "Data opcional. Se vazia, assume a data inicial."],
  ["notas", "Texto opcional com ate 2.000 caracteres."],
  ["Importacao", "Cada linha representa um evento. Estruturas inexistentes podem ser criadas apos revisao."],
];

export const createCalendarSpreadsheetBuffer = (
  snapshot?: CalendarSnapshot,
  selection?: CalendarSpreadsheetExportSelection
) =>
  createXlsx([
    {
      name: EVENTS_SHEET_NAME,
      rows: getExportRows(snapshot, selection),
      widths: [24, 24, 40, 16, 16, 48],
    },
    {
      name: INSTRUCTIONS_SHEET_NAME,
      rows: INSTRUCTION_ROWS,
      widths: [26, 92],
    },
  ]);

const downloadWorkbook = (buffer: Uint8Array, filename: string) => {
  const blob = new Blob([buffer.slice().buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1_000);
};

export const downloadCalendarSpreadsheetTemplate = async () => {
  downloadWorkbook(createCalendarSpreadsheetBuffer(), "doze52-template-eventos.xlsx");
};

export const exportCalendarSpreadsheet = async (
  snapshot: CalendarSnapshot,
  selection?: CalendarSpreadsheetExportSelection
) => {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadWorkbook(
    createCalendarSpreadsheetBuffer(snapshot, selection),
    "doze52-calendario-" + stamp + ".xlsx"
  );
};
