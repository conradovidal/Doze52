"use client";

import * as React from "react";
import { CategoryColorPicker } from "@/components/category-color-picker";
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

type HabitEditorFieldsProps = {
  name: string;
  color: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  editing: boolean;
  onDelete?: () => void;
  /** Guarda o hábito (e o histórico) fora do acompanhamento, sem apagar. */
  onArchive?: () => void;
  /** Check-ins marcados; aparecem no resumo da exclusão. */
  checkInCount?: number;
  onCancel: () => void;
  // Quando embutido num Dialog que já tem seu próprio título/scrim (ex.: o
  // painel Organizar), usa cabeçalho simples em vez de duplicar o semântico
  // de Dialog — mesmo critério do EventDialog para o modo popover.
  dialogSemantics?: boolean;
};

export function HabitEditorFields({
  name,
  color,
  onNameChange,
  onColorChange,
  onSubmit,
  editing,
  onDelete,
  onArchive,
  checkInCount = 0,
  onCancel,
  dialogSemantics = true,
}: HabitEditorFieldsProps) {
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  return (
    <form onSubmit={onSubmit}>
      {dialogSemantics ? (
        <DialogHeader>
          <DialogTitle>{editing ? "Editar hábito" : "Novo hábito"}</DialogTitle>
          {editing ? (
            <DialogDescription>
              Atualize nome ou cor sem perder o histórico já registrado.
            </DialogDescription>
          ) : null}
        </DialogHeader>
      ) : editing ? (
        <p className="text-sm text-muted-foreground">
          Atualize nome ou cor sem perder o histórico já registrado.
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          {/* Mesmo princípio do editor de evento: o título do diálogo e o
              placeholder já identificam o campo. */}
          <Input
            id="habit-prototype-name"
            aria-label="Nome do hábito"
            value={name}
            maxLength={80}
            autoFocus
            placeholder="Caminhar, treinar, estudar, meditar, correr, ler…"
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>

        {/* Mesma paleta completa da categoria: o hábito aparece no mesmo
            ano que as categorias, então as cores precisam conversar. */}
        <CategoryColorPicker
          value={color}
          onChange={onColorChange}
          ariaLabel="Cor do hábito"
          fill
        />
      </div>

      {editing && onDelete && confirmingDelete ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-foreground"
        >
          {checkInCount > 0
            ? `Excluir apaga também ${checkInCount} ${checkInCount === 1 ? "check-in" : "check-ins"}.`
            : "Este hábito ainda não tem check-ins."}
          {onArchive ? " Prefere guardar o histórico? Arquive em vez de excluir." : null}
        </p>
      ) : null}

      <DialogFooter className="mt-6">
        {editing && (onArchive || onDelete) ? (
          <div className="flex flex-wrap gap-2 sm:mr-auto">
            {onArchive ? (
              <Button type="button" variant="outline" onClick={onArchive}>
                Arquivar
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                type="button"
                variant="dangerSoft"
                onClick={() => {
                  if (confirmingDelete) onDelete();
                  else setConfirmingDelete(true);
                }}
              >
                {confirmingDelete ? "Confirmar exclusão" : "Excluir hábito"}
              </Button>
            ) : null}
          </div>
        ) : null}
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="premium" disabled={!name.trim()}>
          {editing ? "Salvar alterações" : "Criar hábito"}
        </Button>
      </DialogFooter>
    </form>
  );
}

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
  onArchive,
  checkInCount,
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
  onArchive?: () => void;
  checkInCount?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[430px]">
        {open ? (
          <HabitEditorFields
            name={name}
            color={color}
            onNameChange={onNameChange}
            onColorChange={onColorChange}
            onSubmit={onSubmit}
            editing={editing}
            onDelete={onDelete}
            onArchive={onArchive}
            checkInCount={checkInCount}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
