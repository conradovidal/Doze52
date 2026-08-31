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
  ChevronDown,
  CircleCheck,
  GripVertical,
  PencilLine,
  Plus,
} from "lucide-react";

import { CollapsibleControlRegion } from "@/components/ui/collapsible-control-region";
import {
  GuidedToolbarNoticeCard,
  type GuidedToolbarNotice,
} from "@/components/onboarding/guided-toolbar-notice";
import { GuidedTargetOutline } from "@/components/onboarding/guided-target-outline";
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
import {
  DESKTOP_CONTROL_DIVIDER_CLASS,
  DESKTOP_CONTROL_GRID_GAP_CLASS,
  DESKTOP_CONTROL_MAX_WIDTH_CLASS,
  DESKTOP_CONTROL_REGION_TOP_GAP_CLASS,
  DESKTOP_CONTROL_ROW_GAP_CLASS,
} from "@/lib/desktop-control-layout";

const HABIT_CONTROLS_EXPANDED_STORAGE_KEY = "doze52:habit-controls:expanded";

type HabitControlsProps = {
  habits: Habit[];
  selectedHabit: Habit | null;
  visibleHabitIds?: ReadonlySet<string>;
  isEditing?: boolean;
  mobile?: boolean;
  creationDisabled: boolean;
  onSelectHabit: (habitId: string) => void;
  onToggleHabitVisibility?: (habitId: string) => void;
  onRequestCreate: () => void;
  onEditHabit?: (habitId: string) => void;
  onReorderHabits?: (orderedIds: string[]) => void;
  guidedNotice?: GuidedToolbarNotice | null;
  onDismissGuidedNotice?: () => void;
  onGuidedNoticeAction?: () => void;
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

export function HabitControls({
  habits,
  selectedHabit,
  visibleHabitIds,
  isEditing = false,
  mobile = false,
  creationDisabled,
  onSelectHabit,
  onToggleHabitVisibility,
  onRequestCreate,
  onEditHabit,
  onReorderHabits,
  guidedNotice = null,
  onDismissGuidedNotice,
  onGuidedNoticeAction,
}: HabitControlsProps) {
  const { mode: themeMode } = useTheme();
  const [expanded, setExpanded] = React.useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = window.localStorage.getItem(HABIT_CONTROLS_EXPANDED_STORAGE_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const setExpandedPersisted = React.useCallback(
    (updater: boolean | ((current: boolean) => boolean)) => {
      setExpanded((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        try {
          window.localStorage.setItem(
            HABIT_CONTROLS_EXPANDED_STORAGE_KEY,
            String(next)
          );
        } catch {
          // Sem persistência entre navegações se o storage falhar; sem impacto na sessão atual.
        }
        return next;
      });
    },
    []
  );
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
          : "flex min-h-8 w-max min-w-full flex-nowrap items-center justify-center gap-1.5 sm:gap-2"
      )}
    >
      {habits.map((habit) => {
        const selected = mobile
          ? selectedHabit?.id === habit.id
          : visibleHabitIds?.has(habit.id) ?? true;
        const colorToken = getCategoryColorToken(habit.color, themeMode);

        return (
          <button
            key={habit.id}
            type="button"
            aria-pressed={selected}
            data-habit-filter={habit.id}
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
            onClick={() => {
              if (!mobile && onToggleHabitVisibility) {
                onToggleHabitVisibility(habit.id);
                return;
              }
              onSelectHabit(habit.id);
            }}
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

      {!creationDisabled ? (
        <button
          type="button"
          data-onboarding-habit-create={guidedNotice?.target === "habit" ? "true" : undefined}
          aria-label="Criar novo hábito"
          title="Criar novo hábito"
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-none transition-all duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-foreground/20 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
            mobile && "h-10 w-full rounded-[8px]",
          )}
          onClick={onRequestCreate}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
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
            ? "grid w-full grid-cols-2 gap-1.5 min-[430px]:grid-cols-3"
            : "flex min-h-8 w-max min-w-full flex-nowrap items-center justify-center gap-1.5 sm:gap-2"
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

  return (
    <section
      data-habit-controls
      data-onboarding-habit-controls
      data-onboarding-habit-showcase={
        guidedNotice?.target === "habit-showcase" ? "true" : undefined
      }
      data-habit-controls-layout={mobile ? "mobile" : "desktop"}
      className={cn(
        "shrink-0",
        mobile
          ? "w-full overflow-hidden rounded-[10px] border border-border bg-card"
          : cn(
              "mx-auto flex w-full flex-col items-center",
              DESKTOP_CONTROL_MAX_WIDTH_CLASS,
              DESKTOP_CONTROL_DIVIDER_CLASS,
              DESKTOP_CONTROL_ROW_GAP_CLASS,
              DESKTOP_CONTROL_REGION_TOP_GAP_CLASS,
              DESKTOP_CONTROL_GRID_GAP_CLASS
            )
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-card text-foreground/70 shadow-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-foreground/18 hover:bg-muted hover:text-foreground active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
              aria-expanded={expanded}
              aria-controls={controlsId}
              aria-label={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
              onClick={() => setExpandedPersisted((current) => !current)}
            >
              <ChevronDown
                className={cn("size-4 transition-transform duration-300", expanded && "rotate-180")}
              />
            </button>
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 pb-0.5">
          <div className="inline-flex h-8 items-center overflow-hidden rounded-[10px] border border-primary bg-primary text-[0.78rem] font-semibold text-primary-foreground">
            <span className="inline-flex h-8 w-7 items-center justify-center" aria-hidden="true">
              <CircleCheck className="size-3.5" />
            </span>
            <span className="pr-2.5">Hábitos</span>
          </div>
          {!isEditing ? (
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-[10px] border border-border bg-card text-foreground/70 transition-colors hover:border-foreground/18 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
              aria-expanded={expanded}
              aria-controls={controlsId}
              aria-label={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
              title={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
              onClick={() => setExpandedPersisted((current) => !current)}
            >
              <ChevronDown
                className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
                aria-hidden="true"
              />
            </button>
          ) : null}
        </div>
      )}

      <CollapsibleControlRegion
        id={controlsId}
        expanded={expanded || isEditing}
        contentClassName={cn(
          mobile
            ? cn(
                "px-2",
                expanded ? "border-t border-border/55 py-2" : "border-0 py-0"
              )
            : "-mx-4 overflow-x-auto px-4 pb-0.5 doze52-scrollbar-none sm:mx-0 sm:px-0"
        )}
      >
          {isEditing ? editableHabitButtons : habitButtons}
      </CollapsibleControlRegion>
      {guidedNotice && onDismissGuidedNotice ? (
        <>
          {guidedNotice.target === "habit" ? (
            <GuidedTargetOutline selector="[data-onboarding-habit-create]" />
          ) : null}
          <GuidedToolbarNoticeCard
            notice={guidedNotice}
            onClose={onDismissGuidedNotice}
            onAction={onGuidedNoticeAction}
            placement="viewport"
            portaled
            anchorSelector={
              guidedNotice.target === "habit"
                ? "[data-onboarding-habit-create]"
                : "[data-onboarding-habit-controls]"
            }
            anchorPlacement="below-center"
          />
        </>
      ) : null}
    </section>
  );
}
