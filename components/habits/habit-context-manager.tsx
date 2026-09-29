"use client";

import * as React from "react";
import { HabitContextIcon } from "@/components/habits/habit-context-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteIconButton } from "@/components/ui/icon-action-button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFeedback } from "@/components/ui/feedback-provider";
import {
  DEFAULT_HABIT_CONTEXT_ICON,
  filterHabitsByContext,
  getHabitContexts,
  HABIT_CONTEXT_ICON_OPTIONS,
  HABIT_CONTEXT_NAME_MAX_LENGTH,
} from "@/lib/habit-contexts";
import { useHabitsStore } from "@/lib/habits-store";
import type { HabitContextIconId } from "@/lib/types";
import { cn } from "@/lib/utils";

export type HabitContextIntent =
  | { mode: "create" }
  | { mode: "edit"; contextId: string };

const pluralize = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Criar, renomear e excluir contexto de hábitos. Mesmo formulário do
 * contexto de Eventos (ProfileManager): nome + ícone, e a exclusão pergunta
 * para onde vão os hábitos. O limite do plano é checado por quem abre.
 */
export function HabitContextManager({
  embedded = false,
  open,
  onOpenChange,
  intent,
  onCreated,
}: {
  /** Só o formulário, sem Dialog — para viver dentro do painel Organizar. */
  embedded?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: HabitContextIntent | null;
  onCreated?: (contextId: string) => void;
}) {
  const storedContexts = useHabitsStore((s) => s.contexts);
  const habits = useHabitsStore((s) => s.habits);
  const checkIns = useHabitsStore((s) => s.checkIns);
  const createContext = useHabitsStore((s) => s.createContext);
  const updateContext = useHabitsStore((s) => s.updateContext);
  const deleteContext = useHabitsStore((s) => s.deleteContext);
  const { notify } = useFeedback();
  const contexts = React.useMemo(() => getHabitContexts(storedContexts), [storedContexts]);
  const editingContext =
    intent?.mode === "edit"
      ? (contexts.find((context) => context.id === intent.contextId) ?? null)
      : null;

  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState<HabitContextIconId>(DEFAULT_HABIT_CONTEXT_ICON);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deleteMode, setDeleteMode] = React.useState<"move" | "delete-all">("move");
  const [moveTargetId, setMoveTargetId] = React.useState("");

  // Layout effect pelo mesmo motivo do editor de contexto de Eventos: sem quadro vazio.
  React.useLayoutEffect(() => {
    if (!open) return;
    setConfirmDeleteOpen(false);
    setDeleteMode("move");
    if (editingContext) {
      setName(editingContext.name);
      setIcon(editingContext.icon);
    } else {
      setName("");
      setIcon(DEFAULT_HABIT_CONTEXT_ICON);
    }
    // Só ao abrir ou trocar de alvo: seguir `editingContext` reiniciaria o
    // formulário a cada gravação vinda de outro aparelho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, intent?.mode, editingContext?.id]);

  const normalizedName = name.trim().slice(0, HABIT_CONTEXT_NAME_MAX_LENGTH).trim();
  const isEdit = intent?.mode === "edit";
  const canSave = normalizedName.length > 0 && (!isEdit || Boolean(editingContext));
  const canDelete = isEdit && Boolean(editingContext) && contexts.length > 1;
  const otherContexts = contexts.filter((context) => context.id !== editingContext?.id);
  const contextHabits = editingContext
    ? filterHabitsByContext(habits, editingContext.id, contexts)
    : [];
  const contextHabitIds = new Set(contextHabits.map((habit) => habit.id));
  const hasHabits = contextHabits.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    if (isEdit && editingContext) {
      updateContext(editingContext.id, { name: normalizedName, icon });
      onOpenChange(false);
      return;
    }
    const createdId = createContext({ name: normalizedName, icon });
    onCreated?.(createdId);
    onOpenChange(false);
  };

  const openDeleteConfirm = () => {
    if (!canDelete) return;
    setMoveTargetId((current) =>
      otherContexts.some((context) => context.id === current)
        ? current
        : (otherContexts[0]?.id ?? "")
    );
    setDeleteMode("move");
    setConfirmDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!editingContext || !canDelete) return;
    const deletingAll = hasHabits && deleteMode === "delete-all";
    const target = deletingAll ? null : moveTargetId || otherContexts[0]?.id || null;
    if (!deletingAll && hasHabits && !target) return;
    const deleted = editingContext;
    // Guarda o estado de antes para o "Desfazer" devolver o contexto aos
    // mesmos hábitos (movidos ou excluídos) com os check-ins deles.
    const previousHabits = habits.filter((habit) => contextHabitIds.has(habit.id));
    const previousCheckIns = Object.values(checkIns).filter((checkIn) =>
      contextHabitIds.has(checkIn.habitId)
    );
    deleteContext(deleted.id, target);
    setConfirmDeleteOpen(false);
    onOpenChange(false);
    const targetName = otherContexts.find((context) => context.id === target)?.name;
    notify({
      tone: "success",
      title: `Contexto "${deleted.name}" excluído`,
      description: !hasHabits
        ? undefined
        : deletingAll
          ? `${pluralize(previousHabits.length, "hábito removido", "hábitos removidos")}.`
          : `${pluralize(previousHabits.length, "hábito movido", "hábitos movidos")} para ${targetName ?? "outro contexto"}.`,
      durationMs: 8000,
      action: {
        label: "Desfazer",
        onClick: () =>
          useHabitsStore
            .getState()
            .restoreContext(deleted, previousHabits, previousCheckIns),
      },
    });
  };

  const body = (
    <>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/75 bg-muted/35 text-foreground shadow-sm">
            <HabitContextIcon icon={icon} size={18} />
          </div>
          <Input
            id="habit-context-name"
            aria-label="Nome do contexto"
            value={name}
            autoFocus
            onChange={(event) =>
              setName(event.target.value.slice(0, HABIT_CONTEXT_NAME_MAX_LENGTH))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSave();
              }
            }}
            maxLength={HABIT_CONTEXT_NAME_MAX_LENGTH}
            placeholder="Saúde, estudos, casa…"
            className="h-11 flex-1 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-6 gap-2 sm:grid-cols-6">
          {HABIT_CONTEXT_ICON_OPTIONS.map((option) => {
            const selected = option.id === icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setIcon(option.id)}
                aria-label={option.label}
                aria-pressed={selected}
                title={option.label}
                className={cn(
                  "inline-flex h-10 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/80 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <HabitContextIcon icon={option.id} size={18} />
              </button>
            );
          })}
        </div>
      </div>

      <DialogFooter className="flex-row items-center justify-between sm:justify-between">
        {canDelete ? (
          <DeleteIconButton label="Excluir contexto" onClick={openDeleteConfirm} />
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="premium" onClick={handleSave} disabled={!canSave}>
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="flex flex-col gap-6">{body}</div>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="p-5 sm:max-w-[480px] sm:p-6">
            <DialogHeader>
              <DialogTitle>{isEdit ? "Editar contexto" : "Novo contexto"}</DialogTitle>
              <DialogDescription className="sr-only">
                {isEdit
                  ? "Ajuste o nome e o ícone deste contexto de hábitos."
                  : "Defina o nome e o ícone do novo contexto de hábitos."}
              </DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Excluir contexto</DialogTitle>
            <DialogDescription>
              {hasHabits
                ? `Este contexto tem ${pluralize(contextHabits.length, "hábito", "hábitos")}. Escolha o que fazer com eles.`
                : "Este contexto está vazio e será excluído."}
            </DialogDescription>
          </DialogHeader>
          {hasHabits ? (
            <div className="space-y-3" role="radiogroup" aria-label="Destino dos hábitos do contexto">
              <div
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                  deleteMode === "move"
                    ? "border-primary/45 bg-primary/5"
                    : "border-border hover:bg-muted/45"
                )}
              >
                <label className="block cursor-pointer">
                  <input
                    type="radio"
                    name="habit-context-delete-mode"
                    value="move"
                    checked={deleteMode === "move"}
                    onChange={() => setDeleteMode("move")}
                    className="sr-only"
                  />
                  <span className="block text-sm font-semibold text-foreground">
                    Mover para outro contexto
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Os hábitos e as marcações passam para o contexto escolhido.
                  </span>
                </label>
                {deleteMode === "move" ? (
                  <Select value={moveTargetId} onValueChange={setMoveTargetId}>
                    <SelectTrigger
                      aria-label="Contexto de destino"
                      className="mt-3 h-10 rounded-xl border-border/80 bg-background shadow-sm"
                    >
                      <SelectValue placeholder="Selecione o contexto de destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherContexts.map((context) => (
                        <SelectItem key={context.id} value={context.id}>
                          {context.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
              <label
                className={cn(
                  "block w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors",
                  deleteMode === "delete-all"
                    ? "border-destructive/45 bg-destructive/5"
                    : "border-border hover:bg-muted/45"
                )}
              >
                <input
                  type="radio"
                  name="habit-context-delete-mode"
                  value="delete-all"
                  checked={deleteMode === "delete-all"}
                  onChange={() => setDeleteMode("delete-all")}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-destructive">
                  Excluir tudo: {pluralize(contextHabits.length, "hábito", "hábitos")} e marcações
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Remove o contexto com todos os hábitos. Dá para desfazer logo depois, por alguns segundos.
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Prefere guardar sem perder nada? Arquive os hábitos em vez de excluir o contexto.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="dangerSoft"
              onClick={handleDelete}
              disabled={hasHabits && deleteMode === "move" && !moveTargetId}
            >
              {hasHabits && deleteMode === "delete-all"
                ? "Excluir contexto e hábitos"
                : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
