"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronDown,
  CircleCheck,
  GripVertical,
  PencilLine,
  Plus,
  RotateCcw,
} from "lucide-react";

import { getCategoryColorToken } from "@/lib/category-palette";
import {
  arraysEqual,
  INLINE_SORTABLE_MEASURING,
  orderItemsByIds,
  pointerAwareCollisionDetection,
  preserveActivatorOffsetModifier,
} from "@/lib/inline-sortable";
import {
  PREMIUM_DROP_ANIMATION,
  PREMIUM_SORTABLE_TRANSITION,
  SORTABLE_ACCESSIBILITY,
} from "@/lib/sortable-motion";
import { useTheme } from "@/lib/theme";
import type { Habit } from "@/lib/types";
import { cn } from "@/lib/utils";

type HabitControlsProps = {
  habits: Habit[];
  totalActiveHabits: number;
  selectedHabit: Habit | null;
  archivedHabits?: Habit[];
  isEditing?: boolean;
  mobile?: boolean;
  creationDisabled: boolean;
  creationDisabledLabel: string | null;
  onSelectHabit: (habitId: string) => void;
  onRequestCreate: () => void;
  onEditHabit?: (habitId: string) => void;
  onReorderHabits?: (orderedIds: string[]) => void;
  onReactivateHabit?: (habitId: string) => void;
  onToggleEditing?: () => void;
};

type DragState = { id: string; width: number | null };

function EditHabitChip({
  habit,
  selected,
  mobile,
  interactiveHandle,
  handleProps,
  setHandleRef,
  isPlaceholder,
  isOverlay,
  style,
  chipRef,
  onSelect,
  onEdit,
}: {
  habit: Habit;
  selected: boolean;
  mobile: boolean;
  interactiveHandle?: boolean;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
  setHandleRef?: (node: HTMLElement | null) => void;
  isPlaceholder?: boolean;
  isOverlay?: boolean;
  style?: React.CSSProperties;
  chipRef?: (node: HTMLElement | null) => void;
  onSelect?: () => void;
  onEdit?: () => void;
}) {
  const { mode: themeMode } = useTheme();
  const colorToken = getCategoryColorToken(habit.color, themeMode);
  return (
    <div
      ref={chipRef}
      style={style}
      data-habit-edit-chip={habit.id}
      data-premium-sortable
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center overflow-hidden rounded-[10px] border bg-card text-[0.78rem] font-semibold transition-[transform,background-color,border-color,box-shadow]",
        mobile && "h-10 w-full rounded-[8px]",
        selected ? "border-foreground/30" : "border-border",
        isOverlay && "shadow-[0_18px_34px_-24px_rgba(15,23,42,0.36)]"
      )}
    >
      {isPlaceholder ? (
        <span className="pointer-events-none absolute inset-[3px] rounded-[8px] border border-dashed border-border bg-muted/70" />
      ) : null}
      <button
        type="button"
        ref={setHandleRef}
        aria-label={`Reordenar hábito ${habit.name}`}
        title={`Reordenar hábito ${habit.name}`}
        className={cn(
          "grid h-full w-8 shrink-0 touch-none place-items-center text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing",
          interactiveHandle && "cursor-grab",
          isPlaceholder && "invisible"
        )}
        {...handleProps}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={`Selecionar hábito ${habit.name}`}
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-2 px-1.5 hover:bg-muted",
          isPlaceholder && "invisible"
        )}
        onClick={onSelect}
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: colorToken.indicator }}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">{habit.name}</span>
      </button>
      <button
        type="button"
        aria-label={`Editar hábito ${habit.name}`}
        title={`Editar hábito ${habit.name}`}
        className={cn(
          "grid h-full w-8 shrink-0 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground",
          isPlaceholder && "invisible"
        )}
        onClick={onEdit}
      >
        <PencilLine className="size-3.5" />
      </button>
    </div>
  );
}

function SortableHabitChip({
  habit,
  selected,
  mobile,
  dragEnabled,
  onSelect,
  onEdit,
}: {
  habit: Habit;
  selected: boolean;
  mobile: boolean;
  dragEnabled: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: habit.id,
    disabled: !dragEnabled,
    data: { sortableLabel: habit.name },
    transition: PREMIUM_SORTABLE_TRANSITION,
  });
  return (
    <EditHabitChip
      habit={habit}
      selected={selected}
      mobile={mobile}
      interactiveHandle={dragEnabled}
      handleProps={{ ...attributes, ...listeners }}
      setHandleRef={setActivatorNodeRef}
      isPlaceholder={dragEnabled && isDragging}
      style={
        dragEnabled && !isDragging
          ? { transform: CSS.Transform.toString(transform), transition }
          : undefined
      }
      chipRef={setNodeRef}
      onSelect={onSelect}
      onEdit={onEdit}
    />
  );
}

export function HabitControls({
  habits,
  totalActiveHabits,
  selectedHabit,
  archivedHabits = [],
  isEditing = false,
  mobile = false,
  creationDisabled,
  creationDisabledLabel,
  onSelectHabit,
  onRequestCreate,
  onEditHabit,
  onReorderHabits,
  onReactivateHabit,
  onToggleEditing,
}: HabitControlsProps) {
  const { mode: themeMode } = useTheme();
  const [expanded, setExpanded] = React.useState(true);
  const controlsId = React.useId();
  const [activeDrag, setActiveDrag] = React.useState<DragState | null>(null);
  const [draftOrderIds, setDraftOrderIds] = React.useState<string[] | null>(null);
  const draftOrderIdsRef = React.useRef<string[] | null>(null);
  const lastOverIdRef = React.useRef<string | null>(null);
  const overlayPortalTarget = typeof document !== "undefined" ? document.body : null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const orderedHabits = React.useMemo(
    () => orderItemsByIds(habits, draftOrderIds),
    [habits, draftOrderIds]
  );
  const activeHabit = orderedHabits.find((habit) => habit.id === activeDrag?.id) ?? null;
  const resetDragState = React.useCallback(() => {
    setActiveDrag(null);
    setDraftOrderIds(null);
    draftOrderIdsRef.current = null;
    lastOverIdRef.current = null;
  }, []);

  React.useEffect(() => {
    if (!isEditing) resetDragState();
  }, [isEditing, resetDragState]);

  const handleDragStart = (event: DragStartEvent) => {
    const ids = orderedHabits.map((habit) => habit.id);
    setActiveDrag({
      id: String(event.active.id),
      width: event.active.rect.current.initial?.width ?? null,
    });
    lastOverIdRef.current = String(event.active.id);
    draftOrderIdsRef.current = ids;
    setDraftOrderIds(ids);
  };
  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    lastOverIdRef.current = String(event.over.id);
    const base = draftOrderIdsRef.current ?? orderedHabits.map((habit) => habit.id);
    const oldIndex = base.indexOf(String(event.active.id));
    const newIndex = base.indexOf(String(event.over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const next = arrayMove(base, oldIndex, newIndex);
    draftOrderIdsRef.current = next;
    setDraftOrderIds(next);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    const currentIds = habits.map((habit) => habit.id);
    let nextIds = draftOrderIdsRef.current;
    const overId = event.over?.id != null
      ? String(event.over.id)
      : lastOverIdRef.current;
    if (!nextIds && overId && event.active.id !== overId) {
      const oldIndex = currentIds.indexOf(String(event.active.id));
      const newIndex = currentIds.indexOf(overId);
      if (oldIndex >= 0 && newIndex >= 0) nextIds = arrayMove(currentIds, oldIndex, newIndex);
    }
    if (overId && nextIds && !arraysEqual(nextIds, currentIds)) {
      onReorderHabits?.(nextIds);
    }
    resetDragState();
  };

  const habitButtons = (
    <div
      className={cn(
        mobile
          ? "grid w-full grid-cols-2 gap-1.5 min-[430px]:grid-cols-3"
          : "flex min-h-8 w-max min-w-full flex-nowrap items-center justify-start gap-1.5 sm:w-full sm:flex-wrap sm:justify-center sm:gap-2"
      )}
    >
      {habits.map((habit) => {
        const selected = selectedHabit?.id === habit.id;
        const colorToken = getCategoryColorToken(habit.color, themeMode);

        return (
          <button
            key={habit.id}
            type="button"
            aria-pressed={selected}
            title={habit.name}
            className={cn(
              "inline-flex items-center overflow-hidden border text-[0.78rem] font-semibold shadow-none transition-[background-color,border-color,color,transform] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
              mobile
                ? "h-10 w-full justify-start rounded-[8px] pr-2 text-left"
                : "h-8 shrink-0 rounded-[10px]",
              selected
                ? "hover:brightness-[0.985]"
                : "border-border bg-card text-muted-foreground/75 hover:border-foreground/18 hover:bg-muted hover:text-foreground"
            )}
            style={
              selected
                ? {
                    backgroundColor: colorToken.soft,
                    borderColor: colorToken.border,
                    color: colorToken.text,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.42)",
                  }
                : undefined
            }
            onClick={() => onSelectHabit(habit.id)}
          >
            <span
              className="inline-flex h-8 w-7 shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              <span
                className="size-2.5 rounded-full"
                style={{
                  backgroundColor: colorToken.indicator,
                  opacity: selected ? 0.95 : 0.52,
                }}
              />
            </span>
            <span
              className={cn(
                "min-w-0 truncate pl-1 pr-3",
                mobile && "text-left text-[0.74rem] leading-[0.84rem]"
              )}
            >
              {habit.name}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        aria-label="Criar novo hábito"
        title={creationDisabledLabel ?? "Criar novo hábito"}
        disabled={creationDisabled}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-none transition-all duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-foreground/20 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:text-muted-foreground/55 disabled:hover:border-border disabled:hover:bg-card",
          mobile && "h-10 w-full rounded-[8px]"
        )}
        onClick={onRequestCreate}
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );

  const editableHabitButtons = (
    <DndContext
      accessibility={SORTABLE_ACCESSIBILITY}
      sensors={sensors}
      collisionDetection={pointerAwareCollisionDetection}
      measuring={INLINE_SORTABLE_MEASURING}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDragState}
    >
      <SortableContext items={orderedHabits.map((habit) => habit.id)} strategy={rectSortingStrategy}>
        <div className={cn(
          mobile
            ? "grid w-full grid-cols-1 gap-1.5 min-[430px]:grid-cols-2"
            : "flex min-h-8 w-full flex-wrap items-center justify-center gap-2"
        )}>
          {orderedHabits.map((habit) => (
            <SortableHabitChip
              key={habit.id}
              habit={habit}
              selected={selectedHabit?.id === habit.id}
              mobile={mobile}
              dragEnabled={orderedHabits.length > 1}
              onSelect={() => onSelectHabit(habit.id)}
              onEdit={() => onEditHabit?.(habit.id)}
            />
          ))}
          <button
            type="button"
            aria-label="Criar novo hábito"
            title={creationDisabledLabel ?? "Criar novo hábito"}
            disabled={creationDisabled}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-card disabled:opacity-45",
              mobile && "h-10 w-full rounded-[8px]"
            )}
            onClick={onRequestCreate}
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </SortableContext>
      {overlayPortalTarget && activeHabit
        ? createPortal(
            <DragOverlay
              dropAnimation={PREMIUM_DROP_ANIMATION}
              modifiers={[preserveActivatorOffsetModifier]}
              zIndex={80}
            >
              <EditHabitChip
                habit={activeHabit}
                selected={selectedHabit?.id === activeHabit.id}
                mobile={mobile}
                isOverlay
                style={{ width: activeDrag?.width ?? undefined }}
              />
            </DragOverlay>,
            overlayPortalTarget
          )
        : null}
    </DndContext>
  );

  return (
    <section
      data-habit-controls
      data-habit-controls-layout={mobile ? "mobile" : "desktop"}
      className={cn(
        "shrink-0",
        mobile
          ? "w-full overflow-hidden rounded-[10px] border border-border bg-card"
          : "mb-2 flex w-full flex-col items-center gap-1.5"
      )}
    >
      <h1 className="sr-only">Hábitos</h1>

      {mobile ? (
        <div className="m-[3px] flex h-10 w-[calc(100%-6px)] items-center gap-1 rounded-[8px] px-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center text-foreground/72">
              <CircleCheck className="size-3.5" aria-hidden="true" />
            </span>
            <span className="truncate text-[13px] font-semibold leading-4 text-foreground">
              Hábitos
            </span>
          </span>
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              data-onboarding-edit-control
              aria-pressed={isEditing}
              aria-label={isEditing ? "Finalizar edição" : "Editar"}
              title={isEditing ? "Finalizar edição" : "Editar"}
              className={cn(
                "grid size-8 place-items-center rounded-[10px] border border-border text-foreground/70",
                isEditing && "border-foreground bg-foreground text-background"
              )}
              onClick={onToggleEditing}
            >
              {isEditing ? <Check className="size-3.5" /> : <PencilLine className="size-3.5" />}
            </button>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-[10px] border border-border text-foreground/70"
              aria-expanded={expanded}
              aria-controls={controlsId}
              aria-label={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
              onClick={() => setExpanded((current) => !current)}
            >
              <ChevronDown
                className={cn("size-4 transition-transform duration-300", expanded && "rotate-180")}
              />
            </button>
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5">
          <div className="inline-flex h-8 items-center overflow-hidden rounded-[10px] border border-primary bg-primary text-[0.78rem] font-semibold text-primary-foreground">
            <span className="inline-flex h-8 w-7 items-center justify-center" aria-hidden="true">
              <CircleCheck className="size-3.5" />
            </span>
            <span className="pr-2.5">Hábitos</span>
          </div>
          <button
            type="button"
            data-onboarding-edit-control
            aria-pressed={isEditing}
            aria-label={isEditing ? "Finalizar edição" : "Editar"}
            title={isEditing ? "Finalizar edição" : "Editar"}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-[10px] border border-border bg-card text-foreground/70",
              isEditing && "border-foreground bg-foreground text-background"
            )}
            onClick={onToggleEditing}
          >
            {isEditing ? <Check className="size-3.5" /> : <PencilLine className="size-3.5" />}
          </button>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-[10px] border border-border bg-card text-foreground/70 transition-colors hover:border-foreground/18 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
            aria-expanded={expanded}
            aria-controls={controlsId}
            aria-label={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
            title={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      <div
        id={controlsId}
        aria-hidden={!expanded}
        inert={!expanded ? true : undefined}
        className={cn(
          "grid w-full transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded
            ? "grid-rows-[1fr] translate-y-0 opacity-100"
            : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0"
        )}
      >
        <div
          className={cn(
            "min-h-0 overflow-hidden",
            mobile
              ? cn(
                  "px-2 transition-[padding,border-color]",
                  expanded ? "border-t border-border/55 py-2" : "border-0 py-0"
                )
              : "-mx-4 overflow-x-auto px-4 pb-0.5 doze52-scrollbar-none sm:mx-0 sm:px-0 md:overflow-visible"
          )}
        >
          {isEditing ? editableHabitButtons : habitButtons}
          {isEditing && archivedHabits.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5" data-archived-habits>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Arquivados
              </span>
              {archivedHabits.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-dashed border-border px-2.5 text-[0.75rem] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onReactivateHabit?.(habit.id)}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  {habit.name}
                </button>
              ))}
            </div>
          ) : null}
          {totalActiveHabits > habits.length ? (
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Mostrando os 4 primeiros hábitos nesta grade.
            </p>
          ) : null}
          {creationDisabledLabel ? (
            <p role="status" className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {creationDisabledLabel}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
