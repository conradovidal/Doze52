import { CATEGORY_PRESET_COLORS, DEFAULT_CATEGORY_COLOR } from "@/lib/category-palette";
import {
  normalizeSpreadsheetHeader,
  type ColumnOrFixedMapping,
  type ImportColumnMapping,
  type SpreadsheetSource,
  type SpreadsheetSourceRow,
} from "@/lib/calendar-spreadsheet";
import { inferProfileIconFromName } from "@/lib/profile-icons";
import type { CalendarSnapshot } from "@/lib/sync";
import type { CalendarEvent, CalendarProfile, CategoryItem } from "@/lib/types";

export const IMPORT_LIMITS = {
  maxNewContexts: 10,
  maxNewCategories: 50,
  maxEvents: 1_000,
} as const;

const DEFAULT_PROFILE_COLOR = "#64748B";

export type ResolutionAction = "create" | "existing" | "ignore" | "unresolved";

export type ContextResolution = {
  key: string;
  sourceValue: string;
  action: ResolutionAction;
  targetId?: string;
  generatedId: string;
  isAutomaticMatch: boolean;
};

export type CategoryResolution = {
  key: string;
  contextKey: string;
  sourceValue: string;
  action: ResolutionAction;
  targetId?: string;
  generatedId: string;
  generatedColor: string;
  isAutomaticMatch: boolean;
};

export type StructureResolution = {
  contexts: ContextResolution[];
  categories: CategoryResolution[];
};

export type ImportIssue = {
  row: number;
  message: string;
};

export type ImportPreviewRow = {
  row: number;
  contextName: string;
  categoryName: string;
  eventName: string;
  startDate: string;
  endDate: string;
};

export type ImportSummary = {
  createdContexts: number;
  createdCategories: number;
  matchedContexts: number;
  matchedCategories: number;
  remappedStructures: number;
  ignoredStructures: number;
  importedEvents: number;
  invalidRows: number;
  duplicateRows: number;
  ignoredRows: number;
};

export type ImportPlan = {
  snapshot: CalendarSnapshot;
  summary: ImportSummary;
  previewRows: ImportPreviewRow[];
  issues: ImportIssue[];
  duplicateRows: number[];
  ignoredRows: number[];
  blockingErrors: string[];
};

export const normalizeImportValue = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

const mappedValue = (row: SpreadsheetSourceRow, mapping: ColumnOrFixedMapping) =>
  mapping.kind === "fixed"
    ? mapping.value.trim()
    : row.values[mapping.columnIndex]?.trim() ?? "";

const categoryKey = (contextKey: string, categoryName: string) =>
  contextKey + "::" + normalizeImportValue(categoryName);

const findByNormalizedName = <T extends { name: string }>(items: T[], name: string) => {
  const normalized = normalizeImportValue(name);
  return items.filter((item) => normalizeImportValue(item.name) === normalized);
};

const preserveContextChoice = (
  previous: ContextResolution | undefined,
  snapshot: CalendarSnapshot
) => {
  if (!previous) return null;
  if (previous.action !== "existing") return previous;
  return snapshot.profiles.some((profile) => profile.id === previous.targetId)
    ? previous
    : null;
};

const resolveProfileId = (resolution: ContextResolution) => {
  if (resolution.action === "existing") return resolution.targetId;
  if (resolution.action === "create") return resolution.generatedId;
  return undefined;
};

const preserveCategoryChoice = (
  previous: CategoryResolution | undefined,
  profileId: string | undefined,
  snapshot: CalendarSnapshot
) => {
  if (!previous) return null;
  if (previous.action !== "existing") return previous;
  return snapshot.categories.some(
    (category) =>
      category.id === previous.targetId &&
      category.profileId === profileId &&
      !category.calendarPackGroupId
  )
    ? previous
    : null;
};

export const createStructureResolution = (
  source: SpreadsheetSource,
  mapping: ImportColumnMapping,
  snapshot: CalendarSnapshot,
  previous?: StructureResolution
): StructureResolution => {
  const previousContexts = new Map(previous?.contexts.map((item) => [item.key, item]));
  const contextValues = new Map<string, string>();
  for (const row of source.rows) {
    const value = mappedValue(row, mapping.context);
    if (value) contextValues.set(normalizeImportValue(value), value);
  }

  const contexts = [...contextValues].map(([key, sourceValue]) => {
    const preserved = preserveContextChoice(previousContexts.get(key), snapshot);
    if (preserved) return { ...preserved, sourceValue };
    const matches = findByNormalizedName(snapshot.profiles, sourceValue);
    return {
      key,
      sourceValue,
      action: matches.length === 1 ? "existing" : matches.length > 1 ? "unresolved" : "create",
      targetId: matches.length === 1 ? matches[0].id : undefined,
      generatedId: previousContexts.get(key)?.generatedId ?? crypto.randomUUID(),
      isAutomaticMatch: matches.length === 1,
    } satisfies ContextResolution;
  });

  const contextByKey = new Map(contexts.map((item) => [item.key, item]));
  const previousCategories = new Map(previous?.categories.map((item) => [item.key, item]));
  const categoryValues = new Map<string, { contextKey: string; sourceValue: string }>();
  for (const row of source.rows) {
    const contextName = mappedValue(row, mapping.context);
    const categoryName = mappedValue(row, mapping.category);
    if (!contextName || !categoryName) continue;
    const contextKey = normalizeImportValue(contextName);
    categoryValues.set(categoryKey(contextKey, categoryName), {
      contextKey,
      sourceValue: categoryName,
    });
  }

  const categories = [...categoryValues].map(([key, value], index) => {
    const context = contextByKey.get(value.contextKey);
    const profileId = context ? resolveProfileId(context) : undefined;
    if (!context || context.action === "ignore") {
      return {
        key,
        contextKey: value.contextKey,
        sourceValue: value.sourceValue,
        action: "ignore",
        generatedId: previousCategories.get(key)?.generatedId ?? crypto.randomUUID(),
        generatedColor:
          previousCategories.get(key)?.generatedColor ??
          CATEGORY_PRESET_COLORS[
            (snapshot.categories.length + index) % CATEGORY_PRESET_COLORS.length
          ] ??
          DEFAULT_CATEGORY_COLOR,
        isAutomaticMatch: false,
      } satisfies CategoryResolution;
    }
    const preserved = preserveCategoryChoice(previousCategories.get(key), profileId, snapshot);
    if (preserved) {
      return { ...preserved, contextKey: value.contextKey, sourceValue: value.sourceValue };
    }
    const matches = profileId
      ? findByNormalizedName(
          snapshot.categories.filter(
            (category) => category.profileId === profileId && !category.calendarPackGroupId
          ),
          value.sourceValue
        )
      : [];
    return {
      key,
      contextKey: value.contextKey,
      sourceValue: value.sourceValue,
      action: matches.length === 1 ? "existing" : matches.length > 1 ? "unresolved" : "create",
      targetId: matches.length === 1 ? matches[0].id : undefined,
      generatedId: previousCategories.get(key)?.generatedId ?? crypto.randomUUID(),
      generatedColor:
        previousCategories.get(key)?.generatedColor ??
        CATEGORY_PRESET_COLORS[(snapshot.categories.length + index) % CATEGORY_PRESET_COLORS.length] ??
        DEFAULT_CATEGORY_COLOR,
      isAutomaticMatch: matches.length === 1,
    } satisfies CategoryResolution;
  });

  return { contexts, categories };
};

export const getImportMappingErrors = (
  source: SpreadsheetSource,
  mapping: ImportColumnMapping
) => {
  const errors: string[] = [];
  const validColumn = (index: number | null) =>
    typeof index === "number" && index >= 0 && index < source.headers.length;
  if (mapping.context.kind === "fixed" && !mapping.context.value.trim()) {
    errors.push("Informe um valor fixo para o contexto.");
  }
  if (mapping.context.kind === "column" && !validColumn(mapping.context.columnIndex)) {
    errors.push("Selecione a coluna de contexto.");
  }
  if (mapping.category.kind === "fixed" && !mapping.category.value.trim()) {
    errors.push("Informe um valor fixo para a categoria.");
  }
  if (mapping.category.kind === "column" && !validColumn(mapping.category.columnIndex)) {
    errors.push("Selecione a coluna de categoria.");
  }
  if (!validColumn(mapping.eventColumn)) errors.push("Selecione a coluna de evento.");
  if (!validColumn(mapping.startDateColumn)) errors.push("Selecione a coluna de data inicial.");
  return errors;
};

const dateAsIso = (value: string) => {
  const text = value.trim();
  const isoCandidate = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoCandidate) {
    const parsed = new Date(isoCandidate + "T00:00:00.000Z");
    return !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === isoCandidate
      ? isoCandidate
      : null;
  }
  const excelSerial = Number(text);
  if (!Number.isFinite(excelSerial) || excelSerial < 1 || excelSerial > 2_958_465) {
    return null;
  }
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(excelSerial) * 86_400_000)
    .toISOString()
    .slice(0, 10);
};

const eventSignature = (
  event: Pick<CalendarEvent, "title" | "categoryId" | "startDate" | "endDate">
) =>
  [
    normalizeImportValue(event.title),
    event.categoryId,
    event.startDate,
    event.endDate,
  ].join("::");

const nextDayOrder = (events: CalendarEvent[], startDate: string, endDate: string) => {
  const singleDay = startDate === endDate;
  let maximum = -1;
  for (const event of events) {
    const sameKind = singleDay
      ? event.startDate === startDate && event.endDate === endDate
      : event.startDate !== event.endDate;
    if (sameKind) maximum = Math.max(maximum, event.dayOrder);
  }
  return maximum + 1;
};

export const buildImportPlan = (
  source: SpreadsheetSource,
  mapping: ImportColumnMapping,
  resolution: StructureResolution,
  snapshot: CalendarSnapshot
): ImportPlan => {
  const blockingErrors = getImportMappingErrors(source, mapping);
  const issues: ImportIssue[] = [];
  const duplicateRows: number[] = [];
  const ignoredRows: number[] = [];
  const previewRows: ImportPreviewRow[] = [];
  const importedEvents: CalendarEvent[] = [];
  const usedContextKeys = new Set<string>();
  const usedCategoryKeys = new Set<string>();

  const contextByKey = new Map(resolution.contexts.map((item) => [item.key, item]));
  const categoryByKey = new Map(resolution.categories.map((item) => [item.key, item]));
  for (const item of resolution.contexts) {
    if (item.action === "unresolved") {
      blockingErrors.push('Resolva o contexto ambiguo "' + item.sourceValue + '".');
    }
  }
  for (const item of resolution.categories) {
    if (item.action === "unresolved") {
      blockingErrors.push('Resolva a categoria ambigua "' + item.sourceValue + '".');
    }
  }

  const existingCategoryById = new Map(snapshot.categories.map((item) => [item.id, item]));
  const pendingEvents = [...snapshot.events];
  const knownSignatures = new Set(snapshot.events.map(eventSignature));

  for (const row of source.rows) {
    const contextName = mappedValue(row, mapping.context);
    const categoryName = mappedValue(row, mapping.category);
    const eventName =
      mapping.eventColumn === null ? "" : row.values[mapping.eventColumn]?.trim() ?? "";
    const rawStart =
      mapping.startDateColumn === null
        ? ""
        : row.values[mapping.startDateColumn]?.trim() ?? "";
    const rawEnd =
      mapping.endDateColumn === null ? "" : row.values[mapping.endDateColumn]?.trim() ?? "";
    const notes =
      mapping.notesColumn === null ? "" : row.values[mapping.notesColumn]?.trim() ?? "";
    const contextKey = normalizeImportValue(contextName);
    const context = contextByKey.get(contextKey);
    const category = categoryByKey.get(categoryKey(contextKey, categoryName));

    if (context?.action === "ignore" || category?.action === "ignore") {
      ignoredRows.push(row.rowNumber);
      continue;
    }

    const rowIssues: string[] = [];
    if (!contextName) rowIssues.push("contexto vazio");
    if (!categoryName) rowIssues.push("categoria vazia");
    if (!eventName) rowIssues.push("evento vazio");
    if (notes.length > 2_000) rowIssues.push("notas excedem 2.000 caracteres");
    const startDate = dateAsIso(rawStart);
    const endDate = rawEnd ? dateAsIso(rawEnd) : startDate;
    if (!startDate) rowIssues.push("data inicial invalida");
    if (rawEnd && !endDate) rowIssues.push("data final invalida");
    if (startDate && endDate && endDate < startDate) {
      rowIssues.push("data final anterior a data inicial");
    }
    if (!context || context.action === "unresolved") rowIssues.push("contexto nao resolvido");
    if (!category || category.action === "unresolved") rowIssues.push("categoria nao resolvida");

    const profileId = context ? resolveProfileId(context) : undefined;
    const categoryId =
      category?.action === "existing"
        ? category.targetId
        : category?.action === "create"
          ? category.generatedId
          : undefined;
    const existingCategory = categoryId ? existingCategoryById.get(categoryId) : undefined;
    if (existingCategory?.calendarPackGroupId) {
      rowIssues.push("categoria de calendario gerenciado nao aceita importacao");
    }
    if (existingCategory && existingCategory.profileId !== profileId) {
      rowIssues.push("categoria nao pertence ao contexto resolvido");
    }

    if (rowIssues.length > 0 || !startDate || !endDate || !profileId || !categoryId) {
      for (const message of rowIssues) issues.push({ row: row.rowNumber, message });
      continue;
    }

    const color = existingCategory?.color ?? category?.generatedColor ?? DEFAULT_CATEGORY_COLOR;
    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      title: eventName,
      categoryId,
      color,
      startDate,
      endDate,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
      dayOrder: nextDayOrder(pendingEvents, startDate, endDate),
    };
    const signature = eventSignature(event);
    if (knownSignatures.has(signature)) {
      duplicateRows.push(row.rowNumber);
      continue;
    }
    knownSignatures.add(signature);
    pendingEvents.push(event);
    importedEvents.push(event);
    usedContextKeys.add(context!.key);
    usedCategoryKeys.add(category!.key);
    previewRows.push({
      row: row.rowNumber,
      contextName,
      categoryName,
      eventName,
      startDate,
      endDate,
    });
  }

  const newProfiles: CalendarProfile[] = resolution.contexts
    .filter((item) => item.action === "create" && usedContextKeys.has(item.key))
    .map((item, index) => ({
      id: item.generatedId,
      name: item.sourceValue.trim(),
      color: DEFAULT_PROFILE_COLOR,
      icon: inferProfileIconFromName(item.sourceValue),
      position: snapshot.profiles.length + index,
    }));
  const profileIdByContextKey = new Map(
    resolution.contexts.map((item) => [item.key, resolveProfileId(item)])
  );
  const newCategories: CategoryItem[] = resolution.categories
    .filter((item) => item.action === "create" && usedCategoryKeys.has(item.key))
    .flatMap((item) => {
      const profileId = profileIdByContextKey.get(item.contextKey);
      return profileId
        ? [
            {
              id: item.generatedId,
              profileId,
              name: item.sourceValue.trim(),
              color: item.generatedColor,
              visible: true,
            },
          ]
        : [];
    });

  if (newProfiles.length > IMPORT_LIMITS.maxNewContexts) {
    blockingErrors.push(
      "A importacao criaria " +
        newProfiles.length +
        " contextos; o limite e " +
        IMPORT_LIMITS.maxNewContexts +
        ". Valores: " +
        newProfiles.map((item) => item.name).join(", ")
    );
  }
  if (newCategories.length > IMPORT_LIMITS.maxNewCategories) {
    blockingErrors.push(
      "A importacao criaria " +
        newCategories.length +
        " categorias; o limite e " +
        IMPORT_LIMITS.maxNewCategories +
        ". Valores: " +
        newCategories.map((item) => item.name).join(", ")
    );
  }
  if (importedEvents.length > IMPORT_LIMITS.maxEvents) {
    blockingErrors.push(
      "A importacao possui " +
        importedEvents.length.toLocaleString("pt-BR") +
        " eventos validos; o limite e " +
        IMPORT_LIMITS.maxEvents.toLocaleString("pt-BR") +
        ". Linhas excedentes: " +
        previewRows
          .slice(IMPORT_LIMITS.maxEvents)
          .map((row) => row.row + ": " + row.eventName)
          .join(", ")
    );
  }

  const usedContexts = resolution.contexts.filter((item) => usedContextKeys.has(item.key));
  const usedCategories = resolution.categories.filter((item) => usedCategoryKeys.has(item.key));
  const remappedStructures = [...usedContexts, ...usedCategories].filter(
    (item) => item.action === "existing" && !item.isAutomaticMatch
  ).length;
  const summary: ImportSummary = {
    createdContexts: newProfiles.length,
    createdCategories: newCategories.length,
    matchedContexts: usedContexts.filter((item) => item.action === "existing").length,
    matchedCategories: usedCategories.filter((item) => item.action === "existing").length,
    remappedStructures,
    ignoredStructures: [...resolution.contexts, ...resolution.categories].filter(
      (item) => item.action === "ignore"
    ).length,
    importedEvents: importedEvents.length,
    invalidRows: new Set(issues.map((issue) => issue.row)).size,
    duplicateRows: duplicateRows.length,
    ignoredRows: ignoredRows.length,
  };

  return {
    snapshot: {
      profiles: [...snapshot.profiles, ...newProfiles],
      categories: [...snapshot.categories, ...newCategories],
      events: [...snapshot.events, ...importedEvents],
    },
    summary,
    previewRows,
    issues,
    duplicateRows,
    ignoredRows,
    blockingErrors: [...new Set(blockingErrors)],
  };
};

export const getResolvedProfileId = resolveProfileId;

export const getCategoryOptionsForContext = (
  context: ContextResolution,
  snapshot: CalendarSnapshot
) => {
  const profileId = resolveProfileId(context);
  return profileId
    ? snapshot.categories.filter(
        (category) => category.profileId === profileId && !category.calendarPackGroupId
      )
    : [];
};

export const describeMapping = (source: SpreadsheetSource, column: number | null) =>
  column === null ? "Nao importar" : source.headers[column] || "Coluna " + (column + 1);

export const getHeaderSuggestionScore = (header: string, expected: string) =>
  normalizeSpreadsheetHeader(header) === normalizeSpreadsheetHeader(expected) ? 1 : 0;
