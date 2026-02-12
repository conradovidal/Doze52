"use client";

import * as React from "react";
import type { CalendarEvent } from "@/lib/types";
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
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEvent?: CalendarEvent | null;
  seedDate?: string;
  seedRange?: { startDate: string; endDate: string } | null;
  onSubmit: (payload: {
    title: string;
    categoryId: string;
    startDate: string;
    endDate: string;
  }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  const categories = useStore((s) => s.categories);
  const [title, setTitle] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(initialEvent?.title ?? "");
    setCategoryId(initialEvent?.categoryId ?? categories[0]?.id ?? "");
    setStartDate(
      initialEvent?.startDate ?? seedRange?.startDate ?? seedDate ?? ""
    );
    setEndDate(
      initialEvent?.endDate ?? seedRange?.endDate ?? seedDate ?? ""
    );
    setIsSaving(false);
    setSubmitError(null);
  }, [open, initialEvent, seedDate, seedRange, categories]);

  const canSave = title.trim() && startDate && endDate && categoryId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {initialEvent ? "Editar evento" : "Novo evento"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Titulo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
                  setSubmitError(
                    message
                  );
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
                    color:
                      categories.find((category) => category.id === categoryId)?.color ??
                      "#2563eb",
                    createdAt: initialEvent?.createdAt ?? new Date().toISOString(),
                    dayOrder: initialEvent?.dayOrder ?? {},
                  },
                  categoryIds
                );
                await onSubmit({ title, categoryId, startDate, endDate });
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
                setSubmitError(
                  message
                );
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
