"use client";

import * as React from "react";
import {
  AlertCircle,
  Archive,
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
  AsyncStateButton,
  type AsyncButtonState,
} from "@/components/ui/async-state-button";
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
import { ProfileIcon } from "@/components/profile-icon";
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
  type CalendarSpreadsheetExportSelection,
  type ImportColumnMapping,
  type SpreadsheetSource,
} from "@/lib/calendar-spreadsheet";
import { logDevError, logProdError } from "@/lib/safe-log";
import { isAuthorCategory, isAuthorEvent } from "@/lib/calendar-export";
import { exportUserData } from "@/lib/sync";
import { useStore } from "@/lib/store";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type CalendarSpreadsheetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type AssistantStep =
  | "home"
  | "export-scope"
  | "mapping"
  | "structures"
  | "preview"
  | "result";
type ImportMode = "template" | "custom";

type ActionCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
  state: AsyncButtonState;
  pendingLabel: string;
  successLabel: string;
  errorLabel: string;
};

function ActionCard({
  icon,
  title,
  description,
  disabled,
  onClick,
  state,
  pendingLabel,
  successLabel,
  errorLabel,
}: ActionCardProps) {
  return (
    <AsyncStateButton
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      state={state}
      pendingLabel={pendingLabel}
      successLabel={successLabel}
      errorLabel={errorLabel}
      className="h-auto min-h-28 justify-start whitespace-normal rounded-[14px] border-border/75 bg-card p-3 text-left hover:bg-muted/45"
    >
      <span className="block">
        <span className="mb-2 block size-4 text-muted-foreground">{icon}</span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </AsyncStateButton>
  );
}

type ExportScopeCheckboxProps = {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
};

function ExportScopeCheckbox({
  checked,
  indeterminate = false,
  disabled,
  label,
  onChange,
}: ExportScopeCheckboxProps) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      onChange={onChange}
      className="size-4 shrink-0 rounded border-input accent-current disabled:cursor-not-allowed disabled:opacity-45"
    />
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
  const [selectedExportCategoryIds, setSelectedExportCategoryIds] = React.useState<string[]>([]);
  const [result, setResult] = React.useState<ImportSummary | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const [workingAction, setWorkingAction] = React.useState<
    "template" | "export" | "backup" | "import-template" | "import-custom" | null
  >(null);
  const [workingState, setWorkingState] = React.useState<AsyncButtonState>("idle");
  const [actionError, setActionError] = React.useState("");

  const snapshot = React.useMemo(
    () => ({ profiles, categories, events }),
    [profiles, categories, events]
  );
  const authorCategoryIds = React.useMemo(
    () => new Set(categories.filter(isAuthorCategory).map((category) => category.id)),
    [categories]
  );
  const eventCountByCategoryId = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      if (!isAuthorEvent(event) || !authorCategoryIds.has(event.categoryId)) continue;
      counts.set(event.categoryId, (counts.get(event.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [authorCategoryIds, events]);
  const exportableCategories = React.useMemo(
    () => categories.filter((category) =>
      authorCategoryIds.has(category.id) && (eventCountByCategoryId.get(category.id) ?? 0) > 0
    ),
    [authorCategoryIds, categories, eventCountByCategoryId]
  );
  const selectedExportCategoryIdSet = React.useMemo(
    () => new Set(selectedExportCategoryIds),
    [selectedExportCategoryIds]
  );
  const exportSelection = React.useMemo<CalendarSpreadsheetExportSelection>(() => {
    const selectedCategories = exportableCategories.filter(
      (category) =>
        selectedExportCategoryIdSet.has(category.id) &&
        (eventCountByCategoryId.get(category.id) ?? 0) > 0
    );
    return {
      profileIds: [...new Set(selectedCategories.map((category) => category.profileId))],
      categoryIds: selectedCategories.map((category) => category.id),
    };
  }, [eventCountByCategoryId, exportableCategories, selectedExportCategoryIdSet]);
  const selectedExportEventCount = React.useMemo(
    () =>
      exportSelection.categoryIds.reduce(
        (total, categoryId) => total + (eventCountByCategoryId.get(categoryId) ?? 0),
        0
      ),
    [eventCountByCategoryId, exportSelection.categoryIds]
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
    setSelectedExportCategoryIds([]);
    setResult(null);
    setActionError("");
    setIsWorking(false);
    setWorkingAction(null);
    setWorkingState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const runDownload = async (
    action: () => void | Promise<void>,
    successTitle: string,
    logKey: string,
    actionId: "template" | "export" | "backup"
  ) => {
    try {
      setWorkingAction(actionId);
      setWorkingState("pending");
      setIsWorking(true);
      setActionError("");
      await action();
      setWorkingState("success");
      notify({ tone: "success", title: successTitle });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gerar planilha.";
      logDevError(logKey, { message });
      logProdError("Falha ao gerar planilha de calendario.");
      setActionError("Nao foi possivel gerar o arquivo. Tente novamente.");
      setWorkingState("error");
    } finally {
      setIsWorking(false);
    }
  };

  const chooseFile = (nextMode: ImportMode) => {
    pendingModeRef.current = nextMode;
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  const startExport = () => {
    setSelectedExportCategoryIds(
      exportableCategories.map((category) => category.id)
    );
    setWorkingAction(null);
    setWorkingState("idle");
    setActionError("");
    setStep("export-scope");
  };

  const toggleExportCategory = (categoryId: string) => {
    if ((eventCountByCategoryId.get(categoryId) ?? 0) === 0) return;
    setSelectedExportCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };

  const toggleExportProfile = (profileId: string) => {
    const profileCategoryIds = exportableCategories
      .filter((category) => category.profileId === profileId)
      .map((category) => category.id);
    if (profileCategoryIds.length === 0) return;
    setSelectedExportCategoryIds((current) => {
      const currentSet = new Set(current);
      const allSelected = profileCategoryIds.every((id) => currentSet.has(id));
      if (allSelected) return current.filter((id) => !profileCategoryIds.includes(id));
      return [...new Set([...current, ...profileCategoryIds])];
    });
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
      setWorkingAction(
        pendingModeRef.current === "template" ? "import-template" : "import-custom"
      );
      setWorkingState("pending");
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
      setWorkingState("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel ler a planilha.";
      logDevError("calendar-spreadsheet.parse", { message, filename: file.name });
      logProdError("Falha ao ler planilha de calendario.");
      setActionError(message);
      setWorkingState("error");
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
        <div className="grid gap-3 sm:grid-cols-3">
          <ActionCard
            icon={<FileDown className="size-4" />}
            title="Baixar template"
            description="Planilha vazia no formato padrao do Doze52."
            disabled={isWorking}
            state={workingAction === "template" ? workingState : "idle"}
            pendingLabel="Gerando template…"
            successLabel="Template baixado"
            errorLabel="Tentar baixar"
            onClick={() =>
              void runDownload(
                downloadCalendarSpreadsheetTemplate,
                "Template baixado",
                "calendar-spreadsheet.template",
                "template"
              )
            }
          />
          <ActionCard
            icon={<Download className="size-4" />}
            title="Exportar calendario"
            description="Escolha os contextos e categorias antes de baixar."
            disabled={isWorking}
            state="idle"
            pendingLabel="Abrindo seleção…"
            successLabel="Seleção aberta"
            errorLabel="Tentar novamente"
            onClick={startExport}
          />
          <ActionCard
            icon={<Archive className="size-4" />}
            title="Baixar backup técnico"
            description="ZIP com seus dados autorais em JSON e CSV."
            disabled={isWorking}
            state={workingAction === "backup" ? workingState : "idle"}
            pendingLabel="Gerando backup…"
            successLabel="Backup baixado"
            errorLabel="Tentar baixar"
            onClick={() => void runDownload(
              () => exportUserData(snapshot),
              "Backup baixado",
              "calendar-backup.export",
              "backup"
            )}
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
            state={workingAction === "import-template" ? workingState : "idle"}
            pendingLabel="Lendo template…"
            successLabel="Template lido"
            errorLabel="Tentar novamente"
            onClick={() => chooseFile("template")}
          />
          <ActionCard
            icon={<FileSpreadsheet className="size-4" />}
            title="Usar planilha customizada"
            description="Escolha as colunas de uma exportacao do Jira ou outra fonte."
            disabled={isWorking}
            state={workingAction === "import-custom" ? workingState : "idle"}
            pendingLabel="Lendo planilha…"
            successLabel="Planilha lida"
            errorLabel="Tentar novamente"
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

  const renderExportScope = () => {
    const exportableCategoryIds = exportableCategories.map((category) => category.id);
    const allSelected =
      exportableCategoryIds.length > 0 &&
      exportableCategoryIds.every((id) => selectedExportCategoryIdSet.has(id));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border/70 bg-muted/20 p-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {selectedExportEventCount} evento{selectedExportEventCount === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-muted-foreground">
              {exportSelection.profileIds.length} contexto{exportSelection.profileIds.length === 1 ? "" : "s"} e {exportSelection.categoryIds.length} categoria{exportSelection.categoryIds.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={allSelected || exportableCategoryIds.length === 0}
              onClick={() => setSelectedExportCategoryIds(exportableCategoryIds)}
            >
              Selecionar tudo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={selectedExportCategoryIds.length === 0}
              onClick={() => setSelectedExportCategoryIds([])}
            >
              Limpar seleção
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {profiles.map((profile) => {
            const profileCategories = exportableCategories.filter(
              (category) => category.profileId === profile.id
            );
            const exportableProfileCategoryIds = profileCategories
              .filter((category) => (eventCountByCategoryId.get(category.id) ?? 0) > 0)
              .map((category) => category.id);
            const selectedCount = exportableProfileCategoryIds.filter((id) =>
              selectedExportCategoryIdSet.has(id)
            ).length;
            const profileEventCount = exportableProfileCategoryIds.reduce(
              (total, id) => total + (eventCountByCategoryId.get(id) ?? 0),
              0
            );
            const isChecked =
              exportableProfileCategoryIds.length > 0 &&
              selectedCount === exportableProfileCategoryIds.length;
            const isIndeterminate = selectedCount > 0 && !isChecked;

            if (profileCategories.length === 0) return null;

            return (
              <div key={profile.id} className="overflow-hidden rounded-[14px] border border-border/75">
                <label className="flex items-center gap-3 bg-muted/35 px-3 py-2.5">
                  <ExportScopeCheckbox
                    checked={isChecked}
                    indeterminate={isIndeterminate}
                    disabled={exportableProfileCategoryIds.length === 0}
                    label={`Selecionar contexto ${profile.name}`}
                    onChange={() => toggleExportProfile(profile.id)}
                  />
                  <span style={{ color: profile.color }}>
                    <ProfileIcon icon={profile.icon} size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {profile.name}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {profileEventCount} evento{profileEventCount === 1 ? "" : "s"}
                  </span>
                </label>
                <div className="divide-y divide-border/60">
                  {profileCategories.map((category) => {
                      const eventCount = eventCountByCategoryId.get(category.id) ?? 0;
                      const disabled = eventCount === 0;
                      return (
                        <label
                          key={category.id}
                          className={`flex items-center gap-3 px-3 py-2.5 pl-10 ${
                            disabled ? "cursor-not-allowed opacity-55" : ""
                          }`}
                        >
                          <ExportScopeCheckbox
                            checked={selectedExportCategoryIdSet.has(category.id)}
                            disabled={disabled}
                            label={`Selecionar categoria ${category.name}`}
                            onChange={() => toggleExportCategory(category.id)}
                          />
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: category.color }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {category.name}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {eventCount} evento{eventCount === 1 ? "" : "s"}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>

        {exportableCategoryIds.length === 0 ? (
          <div className="rounded-[12px] border border-amber-200/80 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/8 dark:text-amber-100">
            Crie ao menos um evento para exportar o calendario.
          </div>
        ) : null}
      </div>
    );
  };

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
    home: ["Importar ou exportar", "Escolha uma opção para trazer ou baixar seus dados."],
    "export-scope": ["Selecionar dados para exportar", "Escolha os contextos e categorias que devem entrar na planilha."],
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
        {step === "export-scope" ? renderExportScope() : null}
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
          {step === "export-scope" ? (
            <AsyncStateButton
              variant="premium"
              disabled={selectedExportEventCount === 0 || isWorking}
              state={workingAction === "export" ? workingState : "idle"}
              pendingLabel="Gerando exportação…"
              successLabel="Calendário exportado"
              errorLabel="Tentar exportar"
              onClick={() =>
                void runDownload(
                  () => exportCalendarSpreadsheet(snapshot, exportSelection),
                  "Calendario exportado",
                  "calendar-spreadsheet.export",
                  "export"
                )
              }
            >
              Exportar {selectedExportEventCount} evento{selectedExportEventCount === 1 ? "" : "s"}
            </AsyncStateButton>
          ) : null}
          {step === "mapping" ? <Button variant="premium" disabled={mappingErrors.length > 0} onClick={continueFromMapping}>Revisar estruturas</Button> : null}
          {step === "structures" ? <Button variant="premium" disabled={!canAdvanceStructures} onClick={() => setStep("preview")}>Ver pre-visualizacao</Button> : null}
          {step === "preview" ? <Button variant="premium" disabled={!canConfirm} onClick={confirmImport}>Importar {plan?.summary.importedEvents ?? 0} evento(s)</Button> : null}
          {step === "result" ? <Button variant="premium" onClick={() => onOpenChange(false)}>Concluir</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
