"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
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
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore } from "@/lib/store";
import type { AnchorPoint, CalendarEvent, RecurrenceType } from "@/lib/types";
import { logDevError, logProdError } from "@/lib/safe-log";
import { ValidationError, validateEventInput } from "@/lib/validation";

const CHIP_MOTION_CLASS = "duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

type RecurrenceDraft = "none" | RecurrenceType;

const formatDateLabel = (value: string) => {
  if (!value) return "Selecionar data";
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return "Selecionar data";
    return format(parsed, "dd/MM/yyyy");
  } catch {
    return "Selecionar data";
  }
};

function DatePopoverField({
  label,
  value,
  onChange,
  min,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  min?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          if (disabled) return;
          setOpen(nextOpen);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-10 w-full justify-between px-3 text-left font-normal"
          >
            <span className={value ? "text-foreground" : "text-muted-foreground"}>
              {formatDateLabel(value)}
            </span>
            <CalendarDays size={14} className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[220px] p-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <Input
              type="date"
              value={value}
              min={min}
              onChange={(event) => {
                onChange(event.target.value);
                setOpen(false);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

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

  const initialProfileFromEvent = initialEvent
    ? categoryById.get(initialEvent.categoryId)?.profileId ?? ""
    : "";

  const profileOptions = profiles;
  const selectedProfileId = selectedProfileIds[0] ?? "";

  const categoriesForProfile = React.useMemo(() => {
    if (!profileId) return [];
    return categories.filter((category) => category.profileId === profileId);
  }, [categories, profileId]);

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
        className="sm:max-w-[560px]"
      >
        <DialogHeader>
          <DialogTitle>{initialEvent ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Perfil</p>
              <div className="flex flex-wrap gap-2">
                {profileOptions.map((profile) => {
                  const isSelected = profile.id === profileId;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => handleProfileSelect(profile.id)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${CHIP_MOTION_CLASS} ${
                        isSelected
                          ? "border-neutral-500 bg-neutral-300 text-neutral-900 hover:bg-neutral-400 dark:border-neutral-500 dark:bg-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-500"
                          : "border-neutral-300 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                      }`}
                    >
                      <ProfileIcon icon={profile.icon} size={12} className="shrink-0" />
                      <span>{profile.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Categoria</p>
              <div className="flex flex-wrap gap-2">
                {categoriesForProfile.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Crie uma categoria para este perfil.</p>
                ) : (
                  categoriesForProfile.map((category) => {
                    const isSelected = category.id === categoryId;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setCategoryId(category.id)}
                        className={`inline-flex items-center gap-1 rounded-full border border-white/30 px-3 py-1 text-xs text-white transition ${CHIP_MOTION_CLASS} ${
                          isSelected
                            ? "ring-2 ring-offset-1 ring-black/20 dark:ring-white/25"
                            : "opacity-65 hover:opacity-90"
                        }`}
                        style={{ backgroundColor: category.color }}
                      >
                        <span className="h-2 w-2 rounded-full bg-white/80" />
                        <span className="font-medium">{category.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="event-title" className="text-xs font-medium text-muted-foreground">
              Titulo do evento
            </label>
            <Input
              id="event-title"
              placeholder="Ex.: Reuniao de planejamento"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <DatePopoverField
              label="Data inicio"
              value={startDate}
              onChange={(nextDate) => {
                setStartDate(nextDate);
                setEndDate((currentEndDate) => {
                  if (!currentEndDate) return nextDate;
                  return currentEndDate < nextDate ? nextDate : currentEndDate;
                });
              }}
            />
            <DatePopoverField
              label="Data final"
              value={endDate}
              min={startDate || undefined}
              onChange={setEndDate}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Recorrencia</label>
            <Select
              value={recurrenceType}
              onValueChange={(value) => setRecurrenceType(value as RecurrenceDraft)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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
            <div className="space-y-1.5 rounded-md border border-border/70 bg-muted/20 p-3">
              <DatePopoverField
                label="Repetir ate"
                value={recurrenceUntil}
                min={startDate || undefined}
                onChange={setRecurrenceUntil}
              />
              <p className="text-xs text-muted-foreground">
                Ultima data em que o evento pode se repetir.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="event-notes" className="text-xs font-medium text-muted-foreground">
              Descricao
            </label>
            <textarea
              id="event-notes"
              className="min-h-24 w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
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
