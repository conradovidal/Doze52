"use client";

import * as React from "react";
import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { AnchorPoint, CalendarEvent, RecurrenceType } from "@/lib/types";
import { logDevError, logProdError } from "@/lib/safe-log";
import { ValidationError, validateEventInput } from "@/lib/validation";

const CHIP_TRIGGER_CLASS =
  "h-10 w-full rounded-xl border px-3 text-sm shadow-sm transition-colors";
const FIELD_LABEL_CLASS =
  "text-[12px] font-semibold tracking-[-0.01em] text-foreground/78";

type RecurrenceDraft = "none" | RecurrenceType;

export function EventDialog({
  open,
  onOpenChange,
  initialEvent,
  seedDate,
  seedRange,
  anchorPoint,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEvent?: CalendarEvent | null;
  seedDate?: string;
  seedRange?: { startDate: string; endDate: string } | null;
  anchorPoint?: AnchorPoint;
  onSubmit: (payload: {
    title: string;
    categoryId: string;
    startDate: string;
    endDate: string;
    notes?: string;
    recurrenceType?: RecurrenceType;
    recurrenceUntil?: string;
  }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
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
  const [isSaving, setIsSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

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

  const profileOptions = profiles;
  const selectedProfileId = selectedProfileIds[0] ?? "";

  const categoriesForProfile = React.useMemo(() => {
    if (!profileId) return [];
    return categories.filter((category) => category.profileId === profileId);
  }, [categories, profileId]);

  const currentCategory = React.useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId]
  );

  const handleProfileSelect = React.useCallback(
    (nextProfileId: string) => {
      setProfileId(nextProfileId);
      const nextCategories = categories.filter(
        (category) => category.profileId === nextProfileId
      );
      setCategoryId((currentCategoryId) => {
        if (nextCategories.some((category) => category.id === currentCategoryId)) {
          return currentCategoryId;
        }
        return nextCategories[0]?.id ?? "";
      });
    },
    [categories]
  );

  React.useEffect(() => {
    if (!open) return;

    setTitle(initialEvent?.title ?? "");

    const nextProfileId =
      initialProfileFromEvent ||
      selectedProfileId ||
      profileOptions[0]?.id ||
      profiles[0]?.id ||
      "";
    setProfileId(nextProfileId);

    const availableCategories = categories.filter(
      (category) => category.profileId === nextProfileId
    );

    const nextCategoryId =
      initialEvent?.categoryId &&
      availableCategories.some((category) => category.id === initialEvent.categoryId)
        ? initialEvent.categoryId
        : availableCategories[0]?.id ?? "";

    setCategoryId(nextCategoryId);

    const nextStartDate = initialEvent?.startDate ?? seedRange?.startDate ?? seedDate ?? "";
    const nextEndDate = initialEvent?.endDate ?? seedRange?.endDate ?? seedDate ?? "";
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setNotes(initialEvent?.notes ?? "");
    setRecurrenceType(initialEvent?.recurrenceType ?? "none");
    setRecurrenceUntil(initialEvent?.recurrenceUntil ?? "");
    setIsSaving(false);
    setSubmitError(null);
  }, [
    open,
    categories,
    initialEvent,
    initialProfileFromEvent,
    profileOptions,
    profiles,
    seedDate,
    seedRange,
    selectedProfileId,
  ]);

  React.useEffect(() => {
    if (!open) return;
    if (!categoriesForProfile.some((category) => category.id === categoryId)) {
      setCategoryId(categoriesForProfile[0]?.id ?? "");
    }
  }, [open, categoryId, categoriesForProfile]);

  const isRecurring = recurrenceType !== "none";
  const canSave =
    title.trim().length > 0 &&
    startDate.length > 0 &&
    endDate.length > 0 &&
    categoryId.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        anchorPoint={anchorPoint}
        desktopPlacement="right-start"
        mobileMode="sheet"
        className="sm:max-w-[520px] p-5 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle>{initialEvent ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>
            Defina o essencial primeiro: título, datas e categoria. Os detalhes entram depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="event-title" className={FIELD_LABEL_CLASS}>
              Título do evento
            </label>
            <Input
              id="event-title"
              className="h-10 rounded-xl text-[15px]"
              placeholder="Ex.: Reunião de planejamento"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="event-start-date" className={FIELD_LABEL_CLASS}>
                Data de início
              </label>
              <Input
                id="event-start-date"
                className="h-10 rounded-xl"
                type="date"
                value={startDate}
                onChange={(event) => {
                  const nextStartDate = event.target.value;
                  setStartDate(nextStartDate);
                  setEndDate((currentEndDate) => {
                    if (!currentEndDate) return nextStartDate;
                    return currentEndDate < nextStartDate ? nextStartDate : currentEndDate;
                  });
                }}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="event-end-date" className={FIELD_LABEL_CLASS}>
                Data final
              </label>
              <Input
                id="event-end-date"
                className="h-10 rounded-xl"
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={FIELD_LABEL_CLASS}>Perfil</label>
              <Select value={profileId} onValueChange={handleProfileSelect}>
                <SelectTrigger
                  size="sm"
                  className={`${CHIP_TRIGGER_CLASS} border-border/80 bg-background text-foreground hover:bg-muted/70`}
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5 pr-2">
                    {currentProfile ? <ProfileIcon icon={currentProfile.icon} size={12} /> : null}
                    <span className="truncate">{currentProfile?.name ?? "Perfil"}</span>
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
            </div>

            <div className="space-y-1">
              <label className={FIELD_LABEL_CLASS}>Categoria</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger
                  size="sm"
                  className={`${CHIP_TRIGGER_CLASS} border-border/80 bg-background text-foreground hover:bg-muted/70`}
                  disabled={categoriesForProfile.length === 0}
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5 pr-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: currentCategory?.color ?? "#9ca3af" }}
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
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="space-y-2.5 rounded-2xl border border-border/70 bg-muted/25 p-3.5">
            <div className="space-y-0.5">
              <p className={FIELD_LABEL_CLASS}>Recorrência</p>
              <p className="text-xs text-muted-foreground">
                Use apenas quando esse evento se repetir ao longo do ano.
              </p>
            </div>
            <div className={`grid gap-3 ${isRecurring ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              <div className="space-y-1">
                <Select
                  value={recurrenceType}
                  onValueChange={(value) => setRecurrenceType(value as RecurrenceDraft)}
                >
                  <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background shadow-sm">
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
                  <SelectContent position="popper" side="bottom" align="start">
                    <SelectItem value="none">Sem recorrencia</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">A cada 2 semanas</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isRecurring ? (
                <div className="space-y-1">
                  <label htmlFor="event-recurrence-until" className={FIELD_LABEL_CLASS}>
                    Repetir até
                  </label>
                  <Input
                    id="event-recurrence-until"
                    className="h-10 rounded-xl"
                    type="date"
                    min={startDate || undefined}
                    value={recurrenceUntil}
                    onChange={(event) => setRecurrenceUntil(event.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onDelete ? (
            <Button
              variant="dangerSoft"
              disabled={isSaving}
              onClick={async () => {
                if (!onDelete) return;
                try {
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
            </Button>
          ) : (
            <div />
          )}

          <Button
            variant="premium"
            disabled={!canSave || isSaving}
            onClick={async () => {
              try {
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
                await onSubmit({
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
                });
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
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>

        {submitError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {submitError}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
