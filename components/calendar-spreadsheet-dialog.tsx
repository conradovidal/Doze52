"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback-provider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildImportPlan,
  createStructureResolution,
  getCategoryOptionsForContext,
  getImportMappingErrors,
  type ImportPlan,
  type ImportSummary,
  type StructureResolution,
} from "@/lib/calendar-import";
import {
  downloadCalendarSpreadsheetTemplate,
  exportCalendarSpreadsheet,
  getCanonicalImportMapping,
  isCanonicalSpreadsheetSource,
  readSpreadsheetSource,
  suggestImportMapping,
  type ColumnOrFixedMapping,
  type ImportColumnMapping,
  type SpreadsheetSource,
} from "@/lib/calendar-spreadsheet";
import { logDevError, logProdError } from "@/lib/safe-log";
import { useStore } from "@/lib/store";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type CalendarSpreadsheetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type AssistantStep = "home" | "mapping" | "structures" | "preview" | "result";
type ImportMode = "template" | "custom";

type ActionCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
};

function ActionCard({ icon, title, description, disabled, onClick }: ActionCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-[14px] border border-border/75 bg-card p-3 text-left transition-colors hover:bg-muted/45 disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="mb-2 block size-4 text-muted-foreground">{icon}</span>
      <span className="block text-sm font-semibold text-foreground">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
    </button>
  );
}

type ColumnSelectProps = {
  id: string;
  label: string;
  headers: string[];
  value: number | null;
  optional?: boolean;
  onChange: (value: number | null) => void;
};

function ColumnSelect({ id, label, headers, value, optional, onChange }: ColumnSelectProps) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-foreground" htmlFor={id}>
      {label}
      <Select
        value={value === null ? "none" : String(value)}
        onValueChange={(next) => onChange(next === "none" ? null : Number(next))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {optional ? <SelectItem value="none">Nao importar</SelectItem> : null}
          {headers.map((header, index) => (
            <SelectItem key={`${header}-${index}`} value={String(index)}>
              {header || `Coluna ${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

type StructureMappingFieldProps = {
  id: string;
  label: string;
  headers: string[];
  value: ColumnOrFixedMapping;
  fixedPlaceholder: string;
  onChange: (value: ColumnOrFixedMapping) => void;
};

function StructureMappingField({
  id,
  label,
  headers,
  value,
  fixedPlaceholder,
  onChange,
}: StructureMappingFieldProps) {
  const selectValue = value.kind === "fixed" ? "fixed" : `column:${value.columnIndex}`;
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <Select
        value={selectValue}
        onValueChange={(next) =>
          onChange(
            next === "fixed"
              ? { kind: "fixed", value: fixedPlaceholder }
              : { kind: "column", columnIndex: Number(next.split(":")[1]) }
          )
        }
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fixed">Usar valor fixo</SelectItem>
          {headers.map((header, index) => (
            <SelectItem key={`${header}-${index}`} value={`column:${index}`}>
              Coluna: {header || index + 1}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.kind === "fixed" ? (
        <Input
          aria-label={`Valor fixo de ${label.toLocaleLowerCase("pt-BR")}`}
          value={value.value}
          placeholder={fixedPlaceholder}
          onChange={(event) => onChange({ kind: "fixed", value: event.target.value })}
        />
      ) : null}
    </div>
  );
}

function SummaryGrid({ plan }: { plan: ImportPlan }) {
  const items = [
    ["Novos contextos", plan.summary.createdContexts],
    ["Novas categorias", plan.summary.createdCategories],
    ["Estruturas existentes", plan.summary.matchedContexts + plan.summary.matchedCategories],
    ["Remapeadas", plan.summary.remappedStructures],
    ["Estruturas ignoradas", plan.summary.ignoredStructures],
    ["Eventos validos", plan.summary.importedEvents],
    ["Invalidos", plan.summary.invalidRows],
    ["Duplicados", plan.summary.duplicateRows],
    ["Ignorados", plan.summary.ignoredRows],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-[12px] border border-border/70 bg-card px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p>
        </div>
      ))}
    </div>
  );
}

const resultItems = (summary: ImportSummary) => [
  ["Contextos criados", summary.createdContexts],
  ["Categorias criadas", summary.createdCategories],
  ["Estruturas remapeadas", summary.remappedStructures],
  ["Estruturas ignoradas", summary.ignoredStructures],
  ["Eventos importados", summary.importedEvents],
  ["Linhas descartadas", summary.invalidRows],
  ["Duplicatas ignoradas", summary.duplicateRows],
  ["Linhas ignoradas", summary.ignoredRows],
] as const;

export function CalendarSpreadsheetDialog({
  open,
  onOpenChange,
}: CalendarSpreadsheetDialogProps) {
  const { notify } = useFeedback();
  const profiles = useStore((state) => state.profiles);
  const categories = useStore((state) => state.categories);
  const events = useStore((state) => state.events);
  const replaceAllData = useStore((state) => state.replaceAllData);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pendingModeRef = React.useRef<ImportMode>("template");
  const [step, setStep] = React.useState<AssistantStep>("home");
  const [mode, setMode] = React.useState<ImportMode>("template");
  const [fileBuffer, setFileBuffer] = React.useState<ArrayBuffer | null>(null);
  const [filename, setFilename] = React.useState("");
  const [source, setSource] = React.useState<SpreadsheetSource | null>(null);
  const [mapping, setMapping] = React.useState<ImportColumnMapping | null>(null);
  const [resolution, setResolution] = React.useState<StructureResolution | null>(null);
  const [acceptedInvalidRows, setAcceptedInvalidRows] = React.useState(false);
  const [result, setResult] = React.useState<ImportSummary | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const [actionError, setActionError] = React.useState("");

  const snapshot = React.useMemo(
    () => ({ profiles, categories, events }),
    [profiles, categories, events]
  );
  const plan = React.useMemo(
    () =>
      source && mapping && resolution
        ? buildImportPlan(source, mapping, resolution, snapshot)
        : null,
    [mapping, resolution, snapshot, source]
  );
  const mappingErrors = React.useMemo(
    () => (source && mapping ? getImportMappingErrors(source, mapping) : []),
    [mapping, source]
  );

  const reset = React.useCallback(() => {
    setStep("home");
    setMode("template");
    setFileBuffer(null);
    setFilename("");
    setSource(null);
    setMapping(null);
    setResolution(null);
    setAcceptedInvalidRows(false);
    setResult(null);
    setActionError("");
    setIsWorking(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const runDownload = async (
    action: () => Promise<void>,
    successTitle: string,
    logKey: string
  ) => {
    try {
      setIsWorking(true);
      setActionError("");
      await action();
      notify({ tone: "success", title: successTitle });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gerar planilha.";
      logDevError(logKey, { message });
      logProdError("Falha ao gerar planilha de calendario.");
      setActionError("Nao foi possivel gerar o arquivo. Tente novamente.");
    } finally {
      setIsWorking(false);
    }
  };

  const chooseFile = (nextMode: ImportMode) => {
    pendingModeRef.current = nextMode;
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setActionError("");
    if (!file.name.toLocaleLowerCase("pt-BR").endsWith(".xlsx")) {
      setActionError("Selecione um arquivo Excel no formato .xlsx.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setActionError("O arquivo excede o limite de 5 MB.");
      return;
    }

    try {
      setIsWorking(true);
      const nextMode = pendingModeRef.current;
      const buffer = await file.arrayBuffer();
      const nextSource = readSpreadsheetSource(
        buffer,
        nextMode === "template" ? "Eventos" : undefined
      );
      if (nextMode === "template" && !isCanonicalSpreadsheetSource(nextSource)) {
        throw new Error(
          "O template precisa usar contexto, categoria, evento, data_inicial, data_final e notas."
        );
      }
      const nextMapping =
        nextMode === "template"
          ? getCanonicalImportMapping()
          : suggestImportMapping(nextSource);
      setMode(nextMode);
      setFilename(file.name);
      setFileBuffer(buffer);
      setSource(nextSource);
      setMapping(nextMapping);
      setResolution(
        nextMode === "template"
          ? createStructureResolution(nextSource, nextMapping, snapshot)
          : null
      );
      setAcceptedInvalidRows(false);
      setStep(nextMode === "template" ? "structures" : "mapping");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel ler a planilha.";
      logDevError("calendar-spreadsheet.parse", { message, filename: file.name });
      logProdError("Falha ao ler planilha de calendario.");
      setActionError(message);
    } finally {
      setIsWorking(false);
    }
  };

  const selectSheet = (sheetName: string) => {
    if (!fileBuffer) return;
    try {
      const nextSource = readSpreadsheetSource(fileBuffer, sheetName);
      setSource(nextSource);
      setMapping(suggestImportMapping(nextSource));
      setResolution(null);
      setActionError("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Nao foi possivel ler a aba.");
    }
  };

  const continueFromMapping = () => {
    if (!source || !mapping || mappingErrors.length > 0) return;
    setResolution(createStructureResolution(source, mapping, snapshot));
    setAcceptedInvalidRows(false);
    setStep("structures");
  };

  const updateContextResolution = (key: string, value: string) => {
    if (!source || !mapping || !resolution) return;
    const previousContext = resolution.contexts.find((item) => item.key === key);
    const reenabledContext = previousContext?.action === "ignore" && value !== "ignore";
    const next: StructureResolution = {
      ...resolution,
      contexts: resolution.contexts.map((item) =>
        item.key !== key
          ? item
          : value === "create" || value === "ignore"
            ? {
                ...item,
                action: value as "create" | "ignore",
                targetId: undefined,
                isAutomaticMatch: false,
              }
            : {
                ...item,
                action: "existing" as const,
                targetId: value.slice("existing:".length),
                isAutomaticMatch: false,
              }
      ),
      categories: reenabledContext
        ? resolution.categories.filter((item) => item.contextKey !== key)
        : resolution.categories,
    };
    setResolution(createStructureResolution(source, mapping, snapshot, next));
  };

  const updateCategoryResolution = (key: string, value: string) => {
    if (!resolution) return;
    setResolution({
      ...resolution,
      categories: resolution.categories.map((item) =>
        item.key !== key
          ? item
          : value === "create" || value === "ignore"
            ? {
                ...item,
                action: value as "create" | "ignore",
                targetId: undefined,
                isAutomaticMatch: false,
              }
            : {
                ...item,
                action: "existing" as const,
                targetId: value.slice("existing:".length),
                isAutomaticMatch: false,
              }
      ),
    });
  };

  const confirmImport = () => {
    if (
      !plan ||
      plan.blockingErrors.length > 0 ||
      plan.summary.importedEvents === 0 ||
      (plan.summary.invalidRows > 0 && !acceptedInvalidRows)
    ) {
      return;
    }
    replaceAllData(plan.snapshot);
    setResult(plan.summary);
    setStep("result");
    notify({
      tone: "success",
      title: `${plan.summary.importedEvents} evento${plan.summary.importedEvents === 1 ? " importado" : "s importados"}`,
      description: "O calendario foi atualizado em uma unica confirmacao.",
    });
  };

  const back = () => {
    setActionError("");
    if (step === "preview") setStep("structures");
    else if (step === "structures" && mode === "custom") setStep("mapping");
    else setStep("home");
  };

  const renderHome = () => (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Exportar
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionCard
            icon={<FileDown className="size-4" />}
            title="Baixar template"
            description="Planilha vazia no formato padrao do Doze52."
            disabled={isWorking}
            onClick={() =>
              void runDownload(
                downloadCalendarSpreadsheetTemplate,
                "Template baixado",
                "calendar-spreadsheet.template"
              )
            }
          />
          <ActionCard
            icon={<Download className="size-4" />}
            title="Exportar calendario"
            description="Exporta todos os eventos atuais no mesmo formato."
            disabled={isWorking}
            onClick={() =>
              void runDownload(
                () => exportCalendarSpreadsheet(snapshot),
                "Calendario exportado",
                "calendar-spreadsheet.export"
              )
            }
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Importar
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionCard
            icon={<Upload className="size-4" />}
            title="Usar template Doze52"
            description="Reconhece as colunas padrao e pula o mapeamento."
            disabled={isWorking}
            onClick={() => chooseFile("template")}
          />
          <ActionCard
            icon={<FileSpreadsheet className="size-4" />}
            title="Usar planilha customizada"
            description="Escolha as colunas de uma exportacao do Jira ou outra fonte."
            disabled={isWorking}
            onClick={() => chooseFile("custom")}
          />
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Aceita .xlsx de ate 5 MB. Cada linha representa um evento; a importacao nao
        altera nem remove dados existentes.
      </p>
    </div>
  );

  const renderMapping = () => {
    if (!source || !mapping) return null;
    return (
      <div className="space-y-4">
        <div className="rounded-[12px] border border-border/70 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Arquivo</p>
          <p className="truncate text-sm font-semibold text-foreground">{filename}</p>
        </div>
        {source.sheetNames.length > 1 ? (
          <label className="block space-y-1.5 text-xs font-medium text-foreground" htmlFor="sheet">
            Aba da planilha
            <Select value={source.selectedSheetName} onValueChange={selectSheet}>
              <SelectTrigger id="sheet" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {source.sheetNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <StructureMappingField
            id="context-mapping"
            label="Contexto"
            headers={source.headers}
            value={mapping.context}
            fixedPlaceholder="Importado"
            onChange={(context) => setMapping({ ...mapping, context })}
          />
          <StructureMappingField
            id="category-mapping"
            label="Categoria"
            headers={source.headers}
            value={mapping.category}
            fixedPlaceholder="Geral"
            onChange={(category) => setMapping({ ...mapping, category })}
          />
          <ColumnSelect
            id="event-mapping"
            label="Evento *"
            headers={source.headers}
            value={mapping.eventColumn}
            onChange={(eventColumn) => setMapping({ ...mapping, eventColumn })}
          />
          <ColumnSelect
            id="start-mapping"
            label="Data inicial *"
            headers={source.headers}
            value={mapping.startDateColumn}
            onChange={(startDateColumn) => setMapping({ ...mapping, startDateColumn })}
          />
          <ColumnSelect
            id="end-mapping"
            label="Data final"
            headers={source.headers}
            value={mapping.endDateColumn}
            optional
            onChange={(endDateColumn) => setMapping({ ...mapping, endDateColumn })}
          />
          <ColumnSelect
            id="notes-mapping"
            label="Notas"
            headers={source.headers}
            value={mapping.notesColumn}
            optional
            onChange={(notesColumn) => setMapping({ ...mapping, notesColumn })}
          />
        </div>
        <div className="overflow-x-auto rounded-[12px] border border-border/70">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-muted/45 text-muted-foreground">
              <tr>{source.headers.map((header, index) => <th key={`${header}-${index}`} className="whitespace-nowrap px-3 py-2 font-semibold">{header || `Coluna ${index + 1}`}</th>)}</tr>
            </thead>
            <tbody>
              {source.rows.slice(0, 3).map((row) => (
                <tr key={row.rowNumber} className="border-t border-border/60">
                  {row.values.map((value, index) => <td key={index} className="max-w-48 truncate px-3 py-2 text-muted-foreground">{value || "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mappingErrors.length > 0 ? (
          <ul className="space-y-1 text-xs text-rose-700 dark:text-rose-200">
            {mappingErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        ) : null}
      </div>
    );
  };

  const renderStructures = () => {
    if (!resolution || !plan) return null;
    const contextByKey = new Map(resolution.contexts.map((item) => [item.key, item]));
    return (
      <div className="space-y-4">
        <SummaryGrid plan={plan} />
        <p className="text-xs leading-5 text-muted-foreground">
          Nomes iguais sao associados automaticamente, ignorando acentos, caixa e espacos.
          Revise as estruturas desconhecidas antes de continuar.
        </p>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contextos</p>
          {resolution.contexts.map((item) => (
            <div key={item.key} className="grid gap-2 rounded-[12px] border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,1fr)] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{item.sourceValue}</p>
                {item.isAutomaticMatch ? <p className="text-xs text-muted-foreground">Associacao automatica</p> : null}
              </div>
              <Select value={item.action === "existing" ? `existing:${item.targetId}` : item.action} onValueChange={(value) => updateContextResolution(item.key, value)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {item.action === "unresolved" ? <SelectItem value="unresolved" disabled>Selecione um destino</SelectItem> : null}
                  <SelectItem value="create">Criar novo contexto</SelectItem>
                  <SelectItem value="ignore">Ignorar contexto e linhas</SelectItem>
                  {profiles.map((profile) => <SelectItem key={profile.id} value={`existing:${profile.id}`}>Associar a {profile.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categorias</p>
          {resolution.categories.map((item) => {
            const context = contextByKey.get(item.contextKey);
            const options = context ? getCategoryOptionsForContext(context, snapshot) : [];
            const contextName = context?.sourceValue ?? "Contexto nao resolvido";
            return (
              <div key={item.key} className="grid gap-2 rounded-[12px] border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,1fr)] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.sourceValue}</p>
                  <p className="truncate text-xs text-muted-foreground">Em {contextName}</p>
                </div>
                <Select disabled={context?.action === "ignore"} value={item.action === "existing" ? `existing:${item.targetId}` : item.action} onValueChange={(value) => updateCategoryResolution(item.key, value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {item.action === "unresolved" ? <SelectItem value="unresolved" disabled>Selecione um destino</SelectItem> : null}
                    <SelectItem value="create">Criar nova categoria</SelectItem>
                    <SelectItem value="ignore">Ignorar categoria e linhas</SelectItem>
                    {options.map((category) => <SelectItem key={category.id} value={`existing:${category.id}`}>Associar a {category.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
        {plan.blockingErrors.length > 0 ? (
          <div className="rounded-[12px] border border-rose-200/80 bg-rose-50/60 p-3 text-xs text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/8 dark:text-rose-100">
            <p className="font-semibold">Resolva antes de continuar</p>
            <ul className="mt-2 space-y-1">{plan.blockingErrors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        ) : null}
      </div>
    );
  };

  const renderPreview = () => {
    if (!plan) return null;
    return (
      <div className="space-y-4">
        <SummaryGrid plan={plan} />
        {plan.issues.length > 0 ? (
          <div className="rounded-[12px] border border-amber-200/80 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/8">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100"><AlertCircle className="size-4" />Linhas que nao serao importadas</p>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs leading-5 text-amber-800 dark:text-amber-200">
              {plan.issues.slice(0, 20).map((issue, index) => <li key={`${issue.row}-${issue.message}-${index}`}>Linha {issue.row}: {issue.message}.</li>)}
            </ul>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-medium text-amber-900 dark:text-amber-100">
              <input type="checkbox" checked={acceptedInvalidRows} onChange={(event) => setAcceptedInvalidRows(event.target.checked)} className="mt-0.5 size-4 rounded border-input accent-current" />
              Estou ciente de que essas linhas serao descartadas.
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-[12px] border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/8 dark:text-emerald-100">
            <CheckCircle2 className="size-4" />A planilha esta pronta para importacao.
          </div>
        )}
        <div className="overflow-hidden rounded-[12px] border border-border/75">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3 bg-muted/45 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><span>Pre-visualizacao</span><span>Datas</span></div>
          {plan.previewRows.slice(0, 8).map((row) => (
            <div key={row.row} className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3 border-t border-border/65 px-3 py-2.5 text-xs">
              <div className="min-w-0"><p className="truncate font-semibold text-foreground">{row.eventName}</p><p className="mt-0.5 truncate text-muted-foreground">{row.contextName} / {row.categoryName}</p></div>
              <p className="whitespace-pre-line text-muted-foreground">{row.startDate}{row.startDate !== row.endDate ? `\n${row.endDate}` : ""}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderResult = () => result ? (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-emerald-200/80 bg-emerald-50/60 p-4 text-center dark:border-emerald-500/20 dark:bg-emerald-500/8">
        <CheckCircle2 className="mx-auto size-7 text-emerald-700 dark:text-emerald-200" />
        <p className="mt-2 text-base font-semibold text-emerald-900 dark:text-emerald-100">Importacao concluida</p>
        <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">O snapshot completo foi aplicado ao calendario.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {resultItems(result).map(([label, value]) => <div key={label} className="rounded-[12px] border border-border/70 bg-card px-3 py-2.5"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p></div>)}
      </div>
    </div>
  ) : null;

  const titles: Record<AssistantStep, [string, string]> = {
    home: ["Importar e exportar com Excel", "Escolha uma jornada para trocar eventos com o Doze52."],
    mapping: ["Mapear colunas", "Defina como a sua planilha representa cada campo do calendario."],
    structures: ["Revisar estruturas", "Crie, associe ou ignore contextos e categorias encontrados."],
    preview: ["Revisar importacao", "Confira o resultado antes de alterar o calendario."],
    result: ["Resultado da importacao", "Veja o que foi criado, importado ou ignorado."],
  };

  const canAdvanceStructures = Boolean(
    plan && plan.blockingErrors.length === 0 && plan.summary.importedEvents > 0
  );
  const canConfirm = Boolean(
    canAdvanceStructures && plan && (plan.summary.invalidRows === 0 || acceptedInvalidRows)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,860px)] overflow-y-auto sm:max-w-[820px]">
        <DialogHeader className="pr-8">
          <div className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border/75 bg-muted/34 text-foreground">
            {isWorking ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
          </div>
          <DialogTitle>{titles[step][0]}</DialogTitle>
          <DialogDescription>{titles[step][1]}</DialogDescription>
        </DialogHeader>

        {step === "home" ? renderHome() : null}
        {step === "mapping" ? renderMapping() : null}
        {step === "structures" ? renderStructures() : null}
        {step === "preview" ? renderPreview() : null}
        {step === "result" ? renderResult() : null}

        {actionError ? (
          <div className="flex gap-2 rounded-[12px] border border-rose-200/80 bg-rose-50/70 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{actionError}</span>
          </div>
        ) : null}

        <DialogFooter>
          {step === "home" ? <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button> : null}
          {step !== "home" && step !== "result" ? <Button variant="ghost" onClick={back}><ArrowLeft className="size-4" />Voltar</Button> : null}
          {step === "mapping" ? <Button variant="premium" disabled={mappingErrors.length > 0} onClick={continueFromMapping}>Revisar estruturas</Button> : null}
          {step === "structures" ? <Button variant="premium" disabled={!canAdvanceStructures} onClick={() => setStep("preview")}>Ver pre-visualizacao</Button> : null}
          {step === "preview" ? <Button variant="premium" disabled={!canConfirm} onClick={confirmImport}>Importar {plan?.summary.importedEvents ?? 0} evento(s)</Button> : null}
          {step === "result" ? <Button variant="premium" onClick={() => onOpenChange(false)}>Concluir</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
