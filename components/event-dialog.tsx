"use client";

import * as React from "react";
import type { AnchorPoint, CalendarEvent, RecurrenceType } from "@/lib/types";
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
import { useStore } from "@/lib/store";
import { logDevError, logProdError } from "@/lib/safe-log";
import { ValidationError, validateEventInput } from "@/lib/validation";

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
  const [recurrenceType, setRecurrenceType] = React.useState<
    "none" | "weekly" | "monthly" | "yearly"
  >("none");
  const [recurrenceUntil, setRecurrenceUntil] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const categoryById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const selectedProfileSet = React.useMemo(
    () => new Set(selectedProfileIds),
    [selectedProfileIds]
  );

  const initialProfileFromEvent = initialEvent
    ? categoryById.get(initialEvent.categoryId)?.profileId ?? ""
    : "";

  const profileOptions = React.useMemo(() => {
    const filtered = profiles.filter(
      (profile) =>
        selectedProfileSet.has(profile.id) || profile.id === initialProfileFromEvent
    );
    return filtered.length > 0 ? filtered : profiles;
  }, [initialProfileFromEvent, profiles, selectedProfileSet]);

  const categoriesForProfile = React.useMemo(() => {
    if (!profileId) return [];
    return categories.filter((category) => category.profileId === profileId);
  }, [categories, profileId]);

  React.useEffect(() => {
    if (!open) return;

    setTitle(initialEvent?.title ?? "");

    const nextProfileId =
      initialProfileFromEvent || profileOptions[0]?.id || profiles[0]?.id || "";
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

    setStartDate(initialEvent?.startDate ?? seedRange?.startDate ?? seedDate ?? "");
    setEndDate(initialEvent?.endDate ?? seedRange?.endDate ?? seedDate ?? "");
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
  ]);

  React.useEffect(() => {
    if (!open) return;
    if (!categoriesForProfile.some((category) => category.id === categoryId)) {
      setCategoryId(categoriesForProfile[0]?.id ?? "");
    }
  }, [open, categoryId, categoriesForProfile]);

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
        desktopAnimation="anchor-origin"
        openState={open}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>{initialEvent ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Titulo"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <Select value={profileId} onValueChange={(value) => setProfileId(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Perfil" />
            </SelectTrigger>
            <SelectContent>
              {profileOptions.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryId} onValueChange={(value) => setCategoryId(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {categoriesForProfile.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={recurrenceType}
              onValueChange={(value) =>
                setRecurrenceType(value as "none" | "weekly" | "monthly" | "yearly")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Recorrencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem recorrencia</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              disabled={recurrenceType === "none"}
              value={recurrenceUntil}
              onChange={(event) => setRecurrenceUntil(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="event-notes" className="text-xs text-muted-foreground">
              Descricao
            </label>
            <textarea
              id="event-notes"
              className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="Descricao"
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
