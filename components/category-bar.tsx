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
import { Eye, EyeOff, GripVertical, Plus } from "lucide-react";
import {
  arraysEqual,
  INLINE_SORTABLE_MEASURING,
  orderItemsByIds,
  pointerAwareCollisionDetection,
  preserveActivatorOffsetModifier,
} from "@/lib/inline-sortable";
import { useStore } from "@/lib/store";
import type { CategoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const MOTION_CLASS = "duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
const CHIP_SHELL_CLASS =
  "group relative inline-flex h-8 items-center overflow-hidden rounded-full border transition-[background-color,border-color,box-shadow,transform] shadow-none";
const CHIP_HANDLE_CLASS =
  "inline-flex h-8 w-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-full text-muted-foreground/72 transition-colors hover:bg-muted/42 hover:text-foreground active:cursor-grabbing";
const CHIP_PLACEHOLDER_CLASS =
  "pointer-events-none absolute inset-[3px] rounded-full border border-dashed border-border/70 bg-muted/26";
const CHIP_OVERLAY_CLASS =
  "border-border/75 bg-background shadow-[0_18px_30px_-18px_rgba(15,23,42,0.28)]";

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.trim().replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return `rgba(99, 102, 241, ${alpha})`;
  }

  const int = Number.parseInt(expanded, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyProfileOrderToAll = (
  allCategories: CategoryItem[],
  profileId: string,
  orderedInProfile: CategoryItem[]
) => {
  let cursor = 0;
  return allCategories.map((category) => {
    if (category.profileId !== profileId) return category;
    const replacement = orderedInProfile[cursor] ?? category;
    cursor += 1;
    return replacement;
  });
};

type CategoryBarProps = {
  compact?: boolean;
  isInlineEditMode?: boolean;
  editingProfileId?: string | null;
  onCreateCategory?: () => void;
  onEditCategory?: (categoryId: string) => void;
};

type DragState = {
  id: string;
  width: number | null;
};

type SortableHandleAttributes = ReturnType<typeof useSortable>["attributes"];
type SortableHandleListeners = ReturnType<typeof useSortable>["listeners"];
type SortableHandleRef = ReturnType<typeof useSortable>["setActivatorNodeRef"];

function EditCategoryChip({
  category,
  onEdit,
  interactiveHandle = false,
  handleAttributes,
  handleListeners,
  setHandleRef,
  isPlaceholder = false,
  isOverlay = false,
  style,
  chipRef,
}: {
  category: CategoryItem;
  onEdit?: () => void;
  interactiveHandle?: boolean;
  handleAttributes?: SortableHandleAttributes;
  handleListeners?: SortableHandleListeners;
  setHandleRef?: SortableHandleRef;
  isPlaceholder?: boolean;
  isOverlay?: boolean;
  style?: React.CSSProperties;
  chipRef?: (node: HTMLElement | null) => void;
}) {
  const contentHiddenClass = isPlaceholder ? "invisible" : "";

  return (
    <div
      ref={chipRef}
      style={style}
      className={cn(
        CHIP_SHELL_CLASS,
        "border-border/60 bg-background text-foreground/78 hover:border-border/78 hover:bg-muted/30 hover:text-foreground",
        isOverlay && CHIP_OVERLAY_CLASS,
        isPlaceholder && "bg-background"
      )}
    >
      {isPlaceholder ? <div className={CHIP_PLACEHOLDER_CLASS} /> : null}

      {interactiveHandle ? (
        <button
          type="button"
          ref={setHandleRef}
          aria-label={`Reordenar categoria ${category.name}`}
          title={`Reordenar categoria ${category.name}`}
          className={cn(CHIP_HANDLE_CLASS, contentHiddenClass)}
          {...handleAttributes}
          {...handleListeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className={cn(CHIP_HANDLE_CLASS, "cursor-default", contentHiddenClass)} aria-hidden="true">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}

      {isOverlay || isPlaceholder ? (
        <div
          className={cn(
            "flex min-w-0 items-center gap-1.5 pl-1 pr-3 text-[0.78rem] font-medium",
            contentHiddenClass
          )}
        >
          <span className="truncate">{category.name}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar categoria ${category.name}`}
          className="flex min-w-0 items-center gap-1.5 pl-1 pr-3 text-[0.78rem] font-medium"
        >
          <span className="truncate">{category.name}</span>
        </button>
      )}
    </div>
  );
}

function SortableEditCategoryChip({
  category,
  dragEnabled,
  onEdit,
}: {
  category: CategoryItem;
  dragEnabled: boolean;
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
    id: category.id,
    disabled: !dragEnabled,
  });

  const style =
    dragEnabled && !isDragging
      ? {
          transform: CSS.Transform.toString(transform),
          transition,
        }
      : undefined;

  return (
    <EditCategoryChip
      category={category}
      onEdit={onEdit}
      interactiveHandle={dragEnabled}
      handleAttributes={attributes}
      handleListeners={listeners}
      setHandleRef={setActivatorNodeRef}
      isPlaceholder={dragEnabled && isDragging}
      style={style}
      chipRef={setNodeRef}
    />
  );
}

export function CategoryBar({
  compact = false,
  isInlineEditMode = false,
  editingProfileId,
  onCreateCategory,
  onEditCategory,
}: CategoryBarProps) {
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const categories = useStore((s) => s.categories);
  const toggleCategoryVisibility = useStore((s) => s.toggleCategoryVisibility);
  const setCategoriesVisibility = useStore((s) => s.setCategoriesVisibility);
  const setCategoriesOrder = useStore((s) => s.setCategoriesOrder);

  const [activeDrag, setActiveDrag] = React.useState<DragState | null>(null);
  const [draftOrderIds, setDraftOrderIds] = React.useState<string[] | null>(null);
  const draftOrderIdsRef = React.useRef<string[] | null>(null);
  const lastOverIdRef = React.useRef<string | null>(null);
  const overlayPortalTarget = typeof document !== "undefined" ? document.body : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeProfileIds = React.useMemo(() => new Set(selectedProfileIds), [selectedProfileIds]);
  const displayedCategories = React.useMemo(
    () =>
      categories.filter((category) =>
        activeProfileIds.has(category.profileId)
      ),
    [categories, activeProfileIds]
  );
  const displayedCategoryIds = React.useMemo(
    () => displayedCategories.map((category) => category.id),
    [displayedCategories]
  );
  const allDisplayedVisible = displayedCategories.every((category) => category.visible);
  const visibilityActionLabel = allDisplayedVisible
    ? "Limpar categorias visiveis"
    : "Mostrar todas as categorias visiveis";

  const categoriesForEditingProfile = React.useMemo(
    () =>
      editingProfileId
        ? categories.filter((category) => category.profileId === editingProfileId)
        : [],
    [categories, editingProfileId]
  );
  const orderedCategoriesForEditingProfile = React.useMemo(
    () => orderItemsByIds(categoriesForEditingProfile, draftOrderIds),
    [categoriesForEditingProfile, draftOrderIds]
  );
  const activeCategory = React.useMemo(
    () =>
      orderedCategoriesForEditingProfile.find((category) => category.id === activeDrag?.id) ??
      null,
    [orderedCategoriesForEditingProfile, activeDrag]
  );
  const dragEnabled = isInlineEditMode && orderedCategoriesForEditingProfile.length > 1;
  const barClass = `${compact ? "w-full min-h-8 justify-center" : "mb-2 min-h-8 justify-center"} flex flex-wrap items-center gap-1.5 sm:gap-2`;

  const resetDragState = React.useCallback(() => {
    setActiveDrag(null);
    setDraftOrderIds(null);
    draftOrderIdsRef.current = null;
    lastOverIdRef.current = null;
  }, []);

  React.useEffect(() => {
    resetDragState();
  }, [editingProfileId, isInlineEditMode, resetDragState]);

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const nextIds = orderedCategoriesForEditingProfile.map((category) => category.id);
      setActiveDrag({
        id: String(event.active.id),
        width: event.active.rect.current.initial?.width ?? null,
      });
      lastOverIdRef.current = String(event.active.id);
      draftOrderIdsRef.current = nextIds;
      setDraftOrderIds(nextIds);
    },
    [orderedCategoriesForEditingProfile]
  );

  const handleDragOver = React.useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      lastOverIdRef.current = String(over.id);
      setDraftOrderIds((current) => {
        const base =
          current ?? orderedCategoriesForEditingProfile.map((category) => category.id);
        const oldIndex = base.indexOf(String(active.id));
        const newIndex = base.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return base;
        const next = arrayMove(base, oldIndex, newIndex);
        draftOrderIdsRef.current = next;
        return next;
      });
    },
    [orderedCategoriesForEditingProfile]
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!editingProfileId) {
        resetDragState();
        return;
      }

      const currentIds = categoriesForEditingProfile.map((category) => category.id);
      let nextIds = draftOrderIdsRef.current;
      const resolvedOverId =
        over?.id != null ? String(over.id) : lastOverIdRef.current;

      if (!nextIds && resolvedOverId && active.id !== resolvedOverId) {
        const oldIndex = currentIds.indexOf(String(active.id));
        const newIndex = currentIds.indexOf(resolvedOverId);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          nextIds = arrayMove(currentIds, oldIndex, newIndex);
        }
      }

      if (resolvedOverId && nextIds && !arraysEqual(nextIds, currentIds)) {
        const nextProfileCategories = orderItemsByIds(categoriesForEditingProfile, nextIds);
        const fullOrder = applyProfileOrderToAll(
          categories,
          editingProfileId,
          nextProfileCategories
        );
        setCategoriesOrder(fullOrder.map((category) => category.id));
      }

      resetDragState();
    },
    [
      categories,
      categoriesForEditingProfile,
      editingProfileId,
      resetDragState,
      setCategoriesOrder,
    ]
  );

  if (!isInlineEditMode && displayedCategories.length === 0) {
    return null;
  }

  if (!isInlineEditMode) {
    return (
      <div className={barClass}>
        {displayedCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={category.visible}
            onClick={() => toggleCategoryVisibility(category.id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[0.78rem] font-medium shadow-none transition-all ${MOTION_CLASS} ${
              category.visible
                ? "text-foreground hover:brightness-[0.97]"
                : "bg-background/70 text-muted-foreground hover:border-border/75 hover:bg-muted/35 hover:text-foreground dark:bg-background/45 dark:hover:bg-accent/45"
            }`}
            style={{
              backgroundColor: category.visible
                ? hexToRgba(category.color, 0.1)
                : "hsl(var(--background))",
              borderColor: category.visible
                ? hexToRgba(category.color, 0.2)
                : "hsl(var(--border) / 0.72)",
            }}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: category.color,
                opacity: category.visible ? 0.92 : 0.5,
              }}
            />
            <span className={category.visible ? "text-foreground" : "text-muted-foreground"}>
              {category.name}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setCategoriesVisibility(displayedCategoryIds, !allDisplayedVisible)}
          className={`inline-flex h-8 items-center justify-center rounded-full border px-2.5 text-muted-foreground/80 shadow-none transition-all ${MOTION_CLASS} ${
            allDisplayedVisible
              ? "border-border/50 bg-background/70 hover:border-border/75 hover:bg-muted/35 hover:text-foreground"
              : "border-border/55 bg-muted/25 text-foreground/85 hover:border-border/75 hover:bg-muted/45 hover:text-foreground"
          }`}
          aria-label={visibilityActionLabel}
          title={visibilityActionLabel}
        >
          {allDisplayedVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerAwareCollisionDetection}
      measuring={INLINE_SORTABLE_MEASURING}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDragState}
    >
      <SortableContext
        items={orderedCategoriesForEditingProfile.map((category) => category.id)}
        strategy={rectSortingStrategy}
      >
        <div className={barClass}>
          {orderedCategoriesForEditingProfile.map((category) => (
            <SortableEditCategoryChip
              key={category.id}
              category={category}
              dragEnabled={dragEnabled}
              onEdit={() => onEditCategory?.(category.id)}
            />
          ))}

          <button
            type="button"
            onClick={onCreateCategory}
            disabled={!editingProfileId}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed px-3 text-[0.78rem] font-medium shadow-none transition-all ${MOTION_CLASS} ${
              editingProfileId
                ? "border-border/70 bg-background text-muted-foreground hover:border-border/85 hover:bg-muted/28 hover:text-foreground"
                : "cursor-not-allowed border-border/55 bg-background/80 text-muted-foreground/55"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova categoria</span>
          </button>
        </div>
      </SortableContext>

      {overlayPortalTarget
        ? createPortal(
            <DragOverlay modifiers={[preserveActivatorOffsetModifier]} zIndex={80}>
              {activeCategory ? (
                <EditCategoryChip
                  category={activeCategory}
                  isOverlay
                  style={{ width: activeDrag?.width ?? undefined }}
                />
              ) : null}
            </DragOverlay>,
            overlayPortalTarget
          )
        : null}
    </DndContext>
  );
}
