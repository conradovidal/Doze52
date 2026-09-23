"use client";

import * as React from "react";
import { ArchiveRestore, Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback-provider";
import { getCategoryColorToken } from "@/lib/category-palette";
import { useHabitsStore } from "@/lib/habits-store";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import type { CategoryItem, Habit } from "@/lib/types";
import { cn } from "@/lib/utils";

const LIST_CLASS =
  "overflow-hidden rounded-[1.1rem] border border-border/70 bg-background";
const ROW_CLASS =
  "flex items-center gap-2.5 border-b border-border/55 px-3.5 py-2.5 last:border-b-0";
const MENU_ITEM_CLASS =
  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-hidden data-[highlighted]:bg-muted";

/** Menu "⋯" compartilhado: Desarquivar e Excluir, com confirmação embutida. */
function ArchivedRowMenu({
  label,
  onUnarchive,
  onDelete,
}: {
  label: string;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Mais ações para ${label}`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[100] min-w-[10.5rem] rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-[0_20px_45px_-30px_rgba(15,23,42,0.38)]"
        >
          <DropdownMenu.Item className={MENU_ITEM_CLASS} onSelect={onUnarchive}>
            <ArchiveRestore className="size-4" aria-hidden="true" />
            Desarquivar
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={cn(MENU_ITEM_CLASS, "text-destructive")}
            onSelect={onDelete}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Excluir…
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Linha de confirmação que substitui a linha normal enquanto se decide. */
function DeleteConfirmRow({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <li className={cn(ROW_CLASS, "bg-destructive/5")} role="alert">
      <p className="min-w-0 flex-1 text-sm">{message}</p>
      <Button variant="ghost" size="sm" className="h-8 rounded-full px-3" onClick={onCancel}>
        Cancelar
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="h-8 rounded-full px-3"
        onClick={onConfirm}
        autoFocus
      >
        Excluir
      </Button>
    </li>
  );
}

function ArchivedCategoryRow({
  category,
  contextName,
  eventCount,
}: {
  category: CategoryItem;
  contextName: string;
  eventCount: number;
}) {
  const { mode: themeMode } = useTheme();
  const { notify } = useFeedback();
  const archiveCategory = useStore((s) => s.archiveCategory);
  const unarchiveCategory = useStore((s) => s.unarchiveCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const restoreDeleted = useStore((s) => s.restoreDeleted);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const token = getCategoryColorToken(category.color, themeMode);
  const showing = category.archiveDisplay === "show";

  const handleDelete = () => {
    const { events } = useStore.getState();
    const removedEvents = events.filter((event) => event.categoryId === category.id);
    const didDelete = deleteCategory({
      categoryId: category.id,
      strategy: { type: "delete-events" },
    });
    if (!didDelete) {
      notify({ title: "Não foi possível excluir esta categoria.", tone: "error" });
      setConfirmingDelete(false);
      return;
    }
    notify({
      title: `Categoria "${category.name}" excluída`,
      description:
        removedEvents.length > 0
          ? `${removedEvents.length} ${removedEvents.length === 1 ? "evento removido" : "eventos removidos"}.`
          : undefined,
      tone: "success",
      durationMs: 7000,
      action: {
        label: "Desfazer",
        onClick: () =>
          restoreDeleted({ categories: [category], events: removedEvents }),
      },
    });
  };

  if (confirmingDelete) {
    return (
      <DeleteConfirmRow
        message={
          eventCount > 0
            ? `Excluir "${category.name}" e ${eventCount} ${eventCount === 1 ? "evento" : "eventos"}?`
            : `Excluir "${category.name}"?`
        }
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    );
  }

  return (
    <li className={ROW_CLASS}>
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full border"
        style={{ backgroundColor: token.soft, borderColor: token.border }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{category.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {contextName} · {eventCount} {eventCount === 1 ? "evento" : "eventos"}
        </p>
      </div>
      <button
        type="button"
        aria-pressed={showing}
        aria-label={
          showing
            ? `Eventos de ${category.name} aparecem no calendário. Tocar para esconder`
            : `Eventos de ${category.name} escondidos. Tocar para mostrar no calendário`
        }
        onClick={() => archiveCategory(category.id, showing ? "hide" : "show")}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          showing
            ? "border-border/70 bg-background text-foreground hover:bg-muted/60"
            : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
        )}
      >
        {showing ? (
          <Eye className="size-3.5" aria-hidden="true" />
        ) : (
          <EyeOff className="size-3.5" aria-hidden="true" />
        )}
        {showing ? "No calendário" : "Escondida"}
      </button>
      <ArchivedRowMenu
        label={category.name}
        onUnarchive={() => unarchiveCategory(category.id)}
        onDelete={() => setConfirmingDelete(true)}
      />
    </li>
  );
}

function ArchivedHabitRow({ habit }: { habit: Habit }) {
  const { notify } = useFeedback();
  const unarchiveHabit = useHabitsStore((s) => s.unarchiveHabit);
  const deleteHabit = useHabitsStore((s) => s.deleteHabit);
  const restoreHabit = useHabitsStore((s) => s.restoreHabit);
  const checkInCount = useHabitsStore(
    (s) =>
      Object.values(s.checkIns).filter(
        (checkIn) => checkIn.habitId === habit.id && checkIn.completed
      ).length
  );
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  const handleDelete = () => {
    const removedCheckIns = Object.values(useHabitsStore.getState().checkIns).filter(
      (checkIn) => checkIn.habitId === habit.id
    );
    deleteHabit(habit.id);
    notify({
      title: `Hábito "${habit.name}" excluído`,
      description:
        checkInCount > 0
          ? `${checkInCount} ${checkInCount === 1 ? "check-in removido" : "check-ins removidos"}.`
          : undefined,
      tone: "success",
      durationMs: 7000,
      action: {
        label: "Desfazer",
        onClick: () => restoreHabit(habit, removedCheckIns),
      },
    });
  };

  if (confirmingDelete) {
    return (
      <DeleteConfirmRow
        message={
          checkInCount > 0
            ? `Excluir "${habit.name}" e ${checkInCount} ${checkInCount === 1 ? "check-in" : "check-ins"}?`
            : `Excluir "${habit.name}"?`
        }
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    );
  }

  return (
    <li className={ROW_CLASS}>
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: habit.color }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{habit.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {checkInCount} {checkInCount === 1 ? "check-in" : "check-ins"}
        </p>
      </div>
      <ArchivedRowMenu
        label={habit.name}
        onUnarchive={() => unarchiveHabit(habit.id)}
        onDelete={() => setConfirmingDelete(true)}
      />
    </li>
  );
}

export function ArchivedItemsSection() {
  const categories = useStore((s) => s.categories);
  const profiles = useStore((s) => s.profiles);
  const events = useStore((s) => s.events);
  const habits = useHabitsStore((s) => s.habits);

  const archivedCategories = React.useMemo(
    () => categories.filter((category) => category.archivedAt),
    [categories]
  );
  const archivedHabits = React.useMemo(
    () => habits.filter((habit) => habit.archivedAt),
    [habits]
  );
  const contextNameById = React.useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.name])),
    [profiles]
  );
  const eventCountByCategoryId = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.categoryId, (counts.get(event.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [events]);

  if (archivedCategories.length === 0 && archivedHabits.length === 0) {
    return (
      <div className="rounded-[1.1rem] border border-dashed border-border/70 px-4 py-10 text-center">
        <p className="text-sm font-medium">Nada arquivado</p>
        <p className="mx-auto mt-1 max-w-[26rem] text-sm text-muted-foreground">
          Arquive uma categoria ou um hábito que não faz mais parte da sua rotina. Os
          eventos e o histórico ficam guardados, e você pode trazer tudo de volta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {archivedCategories.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Categorias
          </h3>
          <ul className={LIST_CLASS}>
            {archivedCategories.map((category) => (
              <ArchivedCategoryRow
                key={category.id}
                category={category}
                contextName={contextNameById.get(category.profileId) ?? "Contexto"}
                eventCount={eventCountByCategoryId.get(category.id) ?? 0}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {archivedHabits.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Hábitos
          </h3>
          <ul className={LIST_CLASS}>
            {archivedHabits.map((habit) => (
              <ArchivedHabitRow key={habit.id} habit={habit} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
