"use client";

import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import * as m from "motion/react-m";
import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import { AsyncStateButton } from "@/components/ui/async-state-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { DateRangeQuickPicker } from "@/components/date-range-quick-picker";
import { RecurrenceUntilPicker } from "@/components/recurrence-until-picker";
import { getCategoryColorToken } from "@/lib/category-palette";
import {
  ONBOARDING_DEFAULT_CATEGORY_ID,
  isOnboardingPersonalDemoGroup,
  useStore,
  type EventInput,
  type EventUpdatePatch,
} from "@/lib/store";
import { useTheme } from "@/lib/theme";
import type { AnchorPoint, CalendarEvent, RecurrenceType } from "@/lib/types";
import type { GuidedCreationIntent } from "@/lib/onboarding";
import { logDevError, logProdError } from "@/lib/safe-log";
import { ValidationError, validateEventInput } from "@/lib/validation";
import { MOTION_SPRING } from "@/lib/motion";

const FIELD_LABEL_CLASS =
  "text-[12px] font-semibold tracking-[-0.01em] text-foreground/78";

type RecurrenceDraft = "none" | RecurrenceType;
type EventInputField = keyof EventInput;

export type EventDialogSubmission =
  | { mode: "create"; input: EventInput }
  | { mode: "update"; patch: EventUpdatePatch };

function subscribeToDesktopViewport(callback: () => void) {
  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getDesktopViewportSnapshot() {
  return window.matchMedia("(min-width: 768px)").matches;
}

const GUIDED_COPY: Record<
  GuidedCreationIntent,
  { title: string; description: string; placeholder: string }
> = {
  dated_item: {
    title: "Algo que já importa",
    description:
      "Comece por algo que já tem data: uma viagem, aniversário, entrega, competição ou mudança.",
    placeholder: "Ex.: Viagem em família",
  },
  period: {
    title: "Adicionar um período",
    description:
      "Escolha o início e o fim de algo que ocupa mais de um dia.",
    placeholder: "Ex.: Curso de especialização",
  },
  additional_context: {
    title: "Mais contexto para o teu ano",
    description:
      "Se não houver uma data exata, use o melhor período aproximado que você tem hoje.",
    placeholder: "Ex.: Preparação para uma mudança",
  },
};

export function EventDialog({
  open,
  onOpenChange,
  initialEvent,
  seedDate,
  seedRange,
  anchorPoint,
  guidedIntent,
  onSubmit,
  onDelete,
  allowManagedMutation = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEvent?: CalendarEvent | null;
  seedDate?: string;
  seedRange?: { startDate: string; endDate: string } | null;
  anchorPoint?: AnchorPoint;
  guidedIntent?: GuidedCreationIntent | null;
  onSubmit: (submission: EventDialogSubmission) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  allowManagedMutation?: boolean;
}) {
  const { mode: themeMode } = useTheme();
  const categories = useStore((s) => s.categories);
  const profiles = useStore((s) => s.profiles);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);

  const [title, setTitle] = React.useState("");
  const [profileId, setProfileId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [recurrenceType, setRecurrenceType] = React.useState<RecurrenceDraft>("none");
  const [recurrenceUntil, setRecurrenceUntil] = React.useState("");
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [activeAction, setActiveAction] = React.useState<"save" | "delete" | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const isDesktopViewport = React.useSyncExternalStore(
    subscribeToDesktopViewport,
    getDesktopViewportSnapshot,
    () => false
  );
  const titleId = React.useId();
  const descriptionId = React.useId();
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const initializedSessionRef = React.useRef<string | null>(null);
  const changedFieldsRef = React.useRef<Set<EventInputField>>(new Set());
  const isManagedEvent = Boolean(
    initialEvent?.calendarPackGroupId && !allowManagedMutation
  );
  const isGuidedCreation = Boolean(guidedIntent && !initialEvent && !isManagedEvent);
  const guidedCopy = guidedIntent ? GUIDED_COPY[guidedIntent] : null;

  const categoryById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const currentProfile = React.useMemo(
    () => profiles.find((profile) => profile.id === profileId) ?? null,
    [profiles, profileId]
  );

  const initialProfileFromEvent = initialEvent
    ? categoryById.get(initialEvent.categoryId)?.profileId ?? ""
    : "";

  const profileOptions = React.useMemo(
    () =>
      profiles.filter(
        (profile) =>
          (isManagedEvent && profile.id === initialProfileFromEvent) ||
          categories.some(
            (category) =>
              category.profileId === profile.id &&
              (!category.calendarPackGroupId ||
                isOnboardingPersonalDemoGroup(category.calendarPackGroupId) ||
                (!isManagedEvent &&
                  category.id === initialEvent?.categoryId))
          )
      ),
    [categories, initialEvent, initialProfileFromEvent, isManagedEvent, profiles]
  );
  const selectedProfileId = selectedProfileIds[0] ?? "";

  const categoriesForProfile = React.useMemo(() => {
    if (!profileId) return [];
    return categories.filter(
      (category) =>
        category.profileId === profileId &&
        (!category.calendarPackGroupId ||
          isOnboardingPersonalDemoGroup(category.calendarPackGroupId) ||
          category.id === initialEvent?.categoryId)
    );
  }, [categories, initialEvent?.categoryId, profileId]);

  const currentCategory = React.useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId]
  );
  const currentCategoryToken = currentCategory
    ? getCategoryColorToken(currentCategory.color, themeMode)
    : null;

  const handleProfileSelect = React.useCallback(
    (nextProfileId: string) => {
      setProfileId(nextProfileId);
      const nextCategories = categories.filter(
        (category) =>
          category.profileId === nextProfileId &&
          (!category.calendarPackGroupId ||
            category.id === initialEvent?.categoryId)
      );
      setCategoryId((currentCategoryId) => {
        const nextCategoryId = nextCategories.some(
          (category) => category.id === currentCategoryId
        )
          ? currentCategoryId
          : nextCategories[0]?.id ?? "";
        if (nextCategoryId !== currentCategoryId) {
          changedFieldsRef.current.add("categoryId");
        }
        return nextCategoryId;
      });
    },
    [categories, initialEvent?.categoryId]
  );

  const initializationSession = initialEvent
    ? `edit:${initialEvent.id}`
    : `create:${seedRange?.startDate ?? seedDate ?? ""}:${seedRange?.endDate ?? ""}:${guidedIntent ?? ""}`;

  React.useEffect(() => {
    if (!open) {
      initializedSessionRef.current = null;
      return;
    }
    if (initializedSessionRef.current === initializationSession) return;
    initializedSessionRef.current = initializationSession;
    changedFieldsRef.current.clear();

    setTitle(initialEvent?.title ?? "");

    const nextProfileId = initialEvent
      ? initialProfileFromEvent
      : (profileOptions.some((profile) => profile.id === selectedProfileId)
          ? selectedProfileId
          : "") ||
        profileOptions[0]?.id ||
        "";
    setProfileId(nextProfileId);

    const availableCategories = categories.filter(
      (category) => category.profileId === nextProfileId
    );

    const guidedDefaultCategoryId = availableCategories.find(
      (category) => category.id === ONBOARDING_DEFAULT_CATEGORY_ID
    )?.id;
    const nextCategoryId = initialEvent
      ? initialEvent.categoryId
      : guidedDefaultCategoryId ?? availableCategories[0]?.id ?? "";

    setCategoryId(nextCategoryId);

    const nextStartDate = initialEvent?.startDate ?? seedRange?.startDate ?? seedDate ?? "";
    const nextEndDate = initialEvent?.endDate ?? seedRange?.endDate ?? seedDate ?? "";
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setNotes(initialEvent?.notes ?? "");
    setRecurrenceType(initialEvent?.recurrenceType ?? "none");
    setRecurrenceUntil(initialEvent?.recurrenceUntil ?? "");
    setAdvancedOpen(
      Boolean(initialEvent && (initialEvent.notes || initialEvent.recurrenceType))
    );
    setIsSaving(false);
    setSubmitError(null);
  }, [
    open,
    categories,
    initializationSession,
    initialEvent,
    initialProfileFromEvent,
    guidedIntent,
    profileOptions,
    profiles,
    seedDate,
    seedRange,
    selectedProfileId,
  ]);

  React.useEffect(() => {
    const rememberFocusedElement = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-slot='dialog-content'], [data-slot='popover-content']")) {
        return;
      }
      returnFocusRef.current = target;
    };
    document.addEventListener("focusin", rememberFocusedElement);
    return () => document.removeEventListener("focusin", rememberFocusedElement);
  }, []);

  const isRecurring = recurrenceType !== "none";
  const hasValidCategory = Boolean(
    currentCategory &&
      currentCategory.profileId === profileId &&
      categoriesForProfile.some((category) => category.id === currentCategory.id)
  );
  const categoryUnavailable = Boolean(initialEvent && !hasValidCategory);
  const canSave =
    !isManagedEvent &&
    title.trim().length > 0 &&
    startDate.length > 0 &&
    endDate.length > 0 &&
    categoryId.length > 0 &&
    hasValidCategory;

  const editorTitle = isManagedEvent
    ? "Detalhes do evento"
    : initialEvent
      ? "Editar evento"
      : guidedCopy?.title ?? "Novo evento";
  const editorDescription = isManagedEvent
    ? "Este evento faz parte de um calendário pronto e é atualizado automaticamente."
    : guidedCopy?.description ??
      "Defina o essencial primeiro: título, datas e categoria. Os detalhes entram depois.";

  const renderEditorContent = (dialogSemantics: boolean) => (
    <>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          {dialogSemantics ? (
            <DialogTitle>{editorTitle}</DialogTitle>
          ) : (
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
              {editorTitle}
            </h2>
          )}
          {dialogSemantics ? (
            <DialogDescription className="sr-only">{editorDescription}</DialogDescription>
          ) : (
            <p id={descriptionId} className="sr-only">
              {editorDescription}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-mr-2 -mt-2 rounded-full"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
        >
          <X />
        </Button>
      </div>

      <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="event-title" className={FIELD_LABEL_CLASS}>
              Título do evento
            </label>
            <Input
              id="event-title"
              className="h-10 rounded-xl text-[15px]"
              placeholder={guidedCopy?.placeholder ?? "Ex.: Reunião de planejamento"}
              value={title}
              disabled={isManagedEvent}
              autoFocus={isGuidedCreation}
              onChange={(event) => {
                changedFieldsRef.current.add("title");
                setTitle(event.target.value);
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={profileId}
              onValueChange={handleProfileSelect}
              disabled={isManagedEvent}
            >
              <SelectTrigger
                size="sm"
                className="h-8 w-auto min-w-0 shrink-0 gap-1.5 rounded-full border-primary bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground shadow-none hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90"
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  {currentProfile ? <ProfileIcon icon={currentProfile.icon} size={12} /> : null}
                  <span className="truncate">{currentProfile?.name ?? "Contexto"}</span>
                </span>
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                {profileOptions.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <span className="inline-flex items-center gap-2">
                      <ProfileIcon icon={profile.icon} size={12} />
                      {profile.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={categoryId}
              onValueChange={(nextCategoryId) => {
                changedFieldsRef.current.add("categoryId");
                setCategoryId(nextCategoryId);
              }}
              disabled={isManagedEvent}
            >
              <SelectTrigger
                size="sm"
                className="h-8 w-auto min-w-0 shrink-0 gap-1.5 rounded-full px-3 text-[12.5px] font-semibold shadow-none"
                style={
                  currentCategoryToken
                    ? {
                        backgroundColor: currentCategoryToken.soft,
                        borderColor: currentCategoryToken.border,
                        color: currentCategoryToken.text,
                      }
                    : undefined
                }
                disabled={categoriesForProfile.length === 0}
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: currentCategoryToken?.indicator ?? "#9ca3af",
                    }}
                  />
                  <span className="truncate">
                    {currentCategory?.name ?? "Sem categoria"}
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                {categoriesForProfile.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: getCategoryColorToken(
                            category.color,
                            themeMode
                          ).indicator,
                        }}
                      />
                      {category.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DateRangeQuickPicker
              startDate={startDate}
              endDate={endDate}
              disabled={isManagedEvent}
              className="min-w-0 flex-1 justify-center"
              onChange={({ startDate: nextStart, endDate: nextEnd }) => {
                changedFieldsRef.current.add("startDate");
                changedFieldsRef.current.add("endDate");
                setStartDate(nextStart);
                setEndDate(nextEnd);
              }}
            />
          </div>

          <details
            open={advancedOpen}
            onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
            className="group"
          >
            <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-[12px] font-semibold text-foreground/78 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              Mais opções
              <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-5 pt-3">

          <div className="space-y-1">
            <label htmlFor="event-notes" className={FIELD_LABEL_CLASS}>
              Descrição
            </label>
            <textarea
              id="event-notes"
              rows={3}
              className="min-h-[4.5rem] w-full resize-y rounded-xl border border-border/80 bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="Adicione detalhes úteis para você se lembrar depois"
              value={notes}
              disabled={isManagedEvent}
              onChange={(event) => {
                changedFieldsRef.current.add("notes");
                setNotes(event.target.value);
              }}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className={FIELD_LABEL_CLASS}>Recorrência</p>
                <p className="text-xs text-muted-foreground">
                  Use apenas quando esse evento se repetir ao longo do ano.
                </p>
              </div>
              <Select
                value={recurrenceType}
                onValueChange={(value) => {
                  changedFieldsRef.current.add("recurrenceType");
                  changedFieldsRef.current.add("recurrenceUntil");
                  setRecurrenceType(value as RecurrenceDraft);
                }}
                disabled={isManagedEvent}
              >
                <SelectTrigger className="h-9 w-auto shrink-0 rounded-xl border-border/80 bg-background shadow-sm">
                  <span>
                    {recurrenceType === "none"
                      ? "Sem recorrencia"
                      : recurrenceType === "weekly"
                        ? "Semanal"
                        : recurrenceType === "biweekly"
                          ? "A cada 2 semanas"
                          : recurrenceType === "monthly"
                            ? "Mensal"
                            : "Anual"}
                  </span>
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="end">
                  <SelectItem value="none">Sem recorrencia</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">A cada 2 semanas</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isRecurring ? (
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <p className={FIELD_LABEL_CLASS}>Repetir até</p>
                <RecurrenceUntilPicker
                  value={recurrenceUntil}
                  minDate={startDate || undefined}
                  disabled={isManagedEvent}
                  onChange={(nextIso) => {
                    changedFieldsRef.current.add("recurrenceUntil");
                    setRecurrenceUntil(nextIso);
                  }}
                />
              </div>
            ) : null}
          </div>
            </div>
          </details>
      </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isManagedEvent ? (
            <div />
          ) : onDelete ? (
            <AsyncStateButton
              variant="dangerSoft"
              state={isSaving && activeAction === "delete" ? "pending" : submitError && activeAction === "delete" ? "error" : "idle"}
              pendingLabel="Excluindo…"
              errorLabel="Tentar excluir"
              disabled={isSaving}
              onClick={async () => {
                if (!onDelete) return;
                try {
                  setActiveAction("delete");
                  setIsSaving(true);
                  setSubmitError(null);
                  await onDelete();
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : "Falhou ao excluir. Tente novamente.";
                  logDevError("event-dialog.delete", {
                    message,
                    hasInitialEvent: Boolean(initialEvent),
                  });
                  logProdError("Falha ao excluir evento.");
                  setSubmitError(message);
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              Excluir
            </AsyncStateButton>
          ) : (
            <div />
          )}

          {isManagedEvent ? (
            <Button variant="premium" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <AsyncStateButton
              variant="premium"
              state={isSaving && activeAction === "save" ? "pending" : submitError && activeAction === "save" ? "error" : "idle"}
              pendingLabel="Salvando…"
              errorLabel="Tentar salvar"
              disabled={!canSave || isSaving}
              onClick={async () => {
              try {
                setActiveAction("save");
                setIsSaving(true);
                setSubmitError(null);
                const categoryIds = new Set(categories.map((category) => category.id));
                validateEventInput(
                  {
                    id: initialEvent?.id ?? crypto.randomUUID(),
                    title,
                    categoryId,
                    startDate,
                    endDate,
                    notes,
                    recurrenceType: recurrenceType === "none" ? undefined : recurrenceType,
                    recurrenceUntil:
                      recurrenceType === "none" || recurrenceUntil.length === 0
                        ? undefined
                        : recurrenceUntil,
                    color:
                      categories.find((category) => category.id === categoryId)?.color ??
                      "#2563eb",
                    createdAt: initialEvent?.createdAt ?? new Date().toISOString(),
                    dayOrder: initialEvent?.dayOrder ?? 0,
                  },
                  categoryIds
                );
                const input: EventInput = {
                  title,
                  categoryId,
                  startDate,
                  endDate,
                  notes,
                  recurrenceType: recurrenceType === "none" ? undefined : recurrenceType,
                  recurrenceUntil:
                    recurrenceType === "none" || recurrenceUntil.length === 0
                      ? undefined
                      : recurrenceUntil,
                };
                if (initialEvent) {
                  const patch: EventUpdatePatch = {};
                  for (const field of changedFieldsRef.current) {
                    Object.assign(patch, { [field]: input[field] });
                  }
                  await onSubmit({ mode: "update", patch });
                } else {
                  await onSubmit({ mode: "create", input });
                }
                onOpenChange(false);
              } catch (error) {
                const message =
                  error instanceof ValidationError
                    ? error.message
                    : error instanceof Error
                      ? error.message
                      : "Falhou ao salvar. Tente novamente.";
                logDevError("event-dialog.submit", {
                  message,
                  hasInitialEvent: Boolean(initialEvent),
                });
                logProdError("Falha ao salvar evento.");
                setSubmitError(message);
              } finally {
                setIsSaving(false);
              }
              }}
            >
              Salvar
            </AsyncStateButton>
          )}
        </DialogFooter>

        {categoryUnavailable ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            A categoria original deste evento não está mais disponível. Escolha
            outra categoria explicitamente ou feche sem salvar.
          </p>
        ) : null}

        {submitError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {submitError}
          </p>
        ) : null}
    </>
  );

  const restoreFocus = () => {
    requestAnimationFrame(() => {
      const sourceDate = seedRange?.endDate ?? seedDate;
      const dateTarget = sourceDate
        ? document.querySelector<HTMLElement>(
            `[data-day-cell][data-day-iso="${CSS.escape(sourceDate)}"]`
          )
        : null;
      const eventTarget = initialEvent
        ? document.querySelector<HTMLElement>(
            `[data-calendar-event-id^="${CSS.escape(initialEvent.id)}"]`
          )
        : null;
      (dateTarget ?? eventTarget ?? returnFocusRef.current)?.focus();
    });
  };

  const rememberAnchorFocus = () => {
    if (returnFocusRef.current?.isConnected) return;
    const anchorElement = anchorPoint
      ? document
          .elementFromPoint(anchorPoint.x, anchorPoint.y)
          ?.closest<HTMLElement>("[data-day-cell], [data-calendar-event-id]")
      : null;
    returnFocusRef.current =
      anchorElement ?? (document.activeElement as HTMLElement | null);
  };

  if (isDesktopViewport && anchorPoint) {
    return (
      <Popover open={open} onOpenChange={onOpenChange} modal>
        <PopoverAnchor asChild>
          <span
            aria-hidden="true"
            className="pointer-events-none fixed size-px"
            style={{ left: anchorPoint.x, top: anchorPoint.y }}
          />
        </PopoverAnchor>
        <PopoverContent
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          side="right"
          align="start"
          sideOffset={12}
          collisionPadding={12}
          className="max-h-[calc(100dvh-1.5rem)] w-[min(440px,calc(100vw-1.5rem))] overflow-y-auto p-0"
          onOpenAutoFocus={rememberAnchorFocus}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
        >
          <m.div
            className="grid gap-4 p-5 sm:p-6"
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={MOTION_SPRING}
          >
            {renderEditorContent(false)}
          </m.div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:max-w-[440px] sm:p-6"
        onOpenAutoFocus={rememberAnchorFocus}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        {renderEditorContent(true)}
      </DialogContent>
    </Dialog>
  );
}
