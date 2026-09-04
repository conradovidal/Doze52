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
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, PencilLine, Plus } from "lucide-react";

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
          "grid h-full w-8 shrink-0 touch-none place-items-center text-muted-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/45",
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
          "flex h-full min-w-0 flex-1 items-center gap-2 px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/45",
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
          "grid h-full w-8 shrink-0 cursor-pointer place-items-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/45",
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

export function HabitEditList({
  habits,
  selectedHabit,
  mobile = false,
  creationDisabled,
  onSelectHabit,
  onRequestCreate,
  onEditHabit,
  onReorderHabits,
}: {
  habits: Habit[];
  selectedHabit: Habit | null;
  mobile?: boolean;
  creationDisabled: boolean;
  onSelectHabit: (habitId: string) => void;
  onRequestCreate: () => void;
  onEditHabit?: (habitId: string) => void;
  onReorderHabits?: (orderedIds: string[]) => void;
}) {
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

  return (
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
            ? "grid w-full grid-cols-2 gap-1.5 min-[430px]:grid-cols-3"
            : "flex min-h-8 w-full flex-wrap items-center gap-1.5 sm:gap-2"
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
          {!creationDisabled ? (
            <button
              type="button"
              aria-label="Criar novo hábito"
              title="Criar novo hábito"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-card",
                mobile && "h-10 w-full rounded-[8px]"
              )}
              onClick={onRequestCreate}
            >
              <Plus className="size-3.5" />
            </button>
          ) : null}
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
}
