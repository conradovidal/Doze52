"use client";

"use client";

import * as React from "react";
import { Check } from "lucide-react";
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
  CATEGORY_COLOR_BASE_BLUE,
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_GREEN,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_VIOLET,
  CATEGORY_COLOR_BASE_YELLOW,
} from "@/lib/category-palette";

export const HABIT_COLORS = [
  CATEGORY_COLOR_BASE_BLUE,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_GREEN,
  CATEGORY_COLOR_BASE_YELLOW,
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_VIOLET,
] as const;

export function HabitEditorDialog({
  open,
  name,
  color,
  onOpenChange,
  onNameChange,
  onColorChange,
  onSubmit,
  editing,
  onDelete,
}: {
  open: boolean;
  name: string;
  color: string;
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  editing: boolean;
  onDelete?: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) setConfirmingDelete(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[430px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar hábito" : "Novo hábito"}</DialogTitle>
            {editing ? (
              <DialogDescription>
                Atualize nome ou cor sem perder o histórico já registrado.
              </DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="habit-prototype-name" className="text-sm font-medium">
                Nome do hábito
              </label>
              <Input
                id="habit-prototype-name"
                value={name}
                maxLength={80}
                autoFocus
                placeholder="Caminhar, treinar, estudar, meditar, correr, ler…"
                onChange={(event) => onNameChange(event.target.value)}
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Cor</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {HABIT_COLORS.map((habitColor) => (
                  <button
                    key={habitColor}
                    type="button"
                    aria-label={`Usar cor ${habitColor}`}
                    aria-pressed={color === habitColor}
                    className="grid size-9 place-items-center rounded-full border border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-foreground/65 aria-pressed:ring-offset-2"
                    style={{ backgroundColor: habitColor }}
                    onClick={() => onColorChange(habitColor)}
                  >
                    {color === habitColor ? (
                      <Check className="size-4 text-neutral-950" strokeWidth={2.6} />
                    ) : null}
                  </button>
                ))}
                <label className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-background text-[10px] font-semibold text-muted-foreground focus-within:ring-2 focus-within:ring-ring/60 focus-within:ring-offset-2">
                  <span aria-hidden="true">+</span>
                  <span className="sr-only">Escolher outra cor</span>
                  <input
                    type="color"
                    value={color}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => onColorChange(event.target.value)}
                  />
                </label>
              </div>
            </fieldset>
          </div>

          <DialogFooter className="mt-6">
            {editing && onDelete ? (
              <Button
                type="button"
                variant="dangerSoft"
                className="sm:mr-auto"
                onClick={() => {
                  if (confirmingDelete) onDelete();
                  else setConfirmingDelete(true);
                }}
              >
                {confirmingDelete ? "Confirmar exclusão" : "Excluir hábito"}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="premium" disabled={!name.trim()}>
              {editing ? "Salvar alterações" : "Criar hábito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
