"use client";

import * as React from "react";
import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  "h-8 w-full rounded-full border px-3 text-xs shadow-none transition-colors";

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
        className="sm:max-w-[460px] p-4 sm:p-5"
      >
        <DialogHeader>
          <DialogTitle>{initialEvent ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Perfil</label>
              <Select value={profileId} onValueChange={handleProfileSelect}>
                <SelectTrigger
                  size="sm"
                  className={`${CHIP_TRIGGER_CLASS} border-neutral-300 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700`}
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5 pr-2">
                    {currentProfile ? <ProfileIcon icon={currentProfile.icon} size={12} /> : null}
                    <span className="truncate">{currentProfile?.name ?? "Perfil"}</span>
                  </span>
                </SelectTrigger>
                <SelectContent align="start">
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
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger
                  size="sm"
                  className={`${CHIP_TRIGGER_CLASS} [&_svg]:text-white/90`}
                  style={
                    currentCategory
                      ? {
                          backgroundColor: currentCategory.color,
                          borderColor: "rgba(255,255,255,0.28)",
                          color: "#fff",
                        }
                      : undefined
                  }
                  disabled={categoriesForProfile.length === 0}
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5 pr-2">
                    <span className="h-2 w-2 rounded-full bg-white/80" />
                    <span className="truncate">
                      {currentCategory?.name ?? "Sem categoria"}
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent align="start">
                  {categoriesForProfile.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span
                        className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-white"
                        style={{ backgroundColor: category.color }}
                      >
                        <span className="h-2 w-2 rounded-full bg-white/80" />
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="event-title" className="text-xs font-medium text-muted-foreground">
              Titulo do evento
            </label>
            <Input
              id="event-title"
              className="h-9"
              placeholder="Ex.: Reuniao de planejamento"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="event-start-date" className="text-xs font-medium text-muted-foreground">
                Data inicio
              </label>
              <Input
                id="event-start-date"
                className="h-9"
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
              <label htmlFor="event-end-date" className="text-xs font-medium text-muted-foreground">
                Data final
              </label>
              <Input
                id="event-end-date"
                className="h-9"
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className={`grid gap-2 ${isRecurring ? "grid-cols-2" : "grid-cols-1"}`}>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Recorrencia</label>
                <Select
                  value={recurrenceType}
                  onValueChange={(value) => setRecurrenceType(value as RecurrenceDraft)}
                >
                  <SelectTrigger className="h-9">
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
                  <SelectContent>
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
                  <label htmlFor="event-recurrence-until" className="text-xs font-medium text-muted-foreground">
                    Repetir ate
                  </label>
                  <Input
                    id="event-recurrence-until"
                    className="h-9"
                    type="date"
                    min={startDate || undefined}
                    value={recurrenceUntil}
                    onChange={(event) => setRecurrenceUntil(event.target.value)}
                  />
                </div>
              ) : null}
            </div>
            {isRecurring ? (
              <p className="text-[11px] text-muted-foreground">
                Ultima data em que o evento pode se repetir.
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="event-notes" className="text-xs font-medium text-muted-foreground">
              Descricao
            </label>
            <textarea
              id="event-notes"
              rows={2}
              className="min-h-[3.5rem] w-full resize-y rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="Adicione detalhes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onDelete ? (
            <Button
              variant="destructive"
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

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
