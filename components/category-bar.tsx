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
import { Eye, EyeOff, GripVertical, PencilLine, Plus } from "lucide-react";
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
const CHIP_LEADING_SLOT_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center";
const CHIP_HANDLE_CLASS =
  "inline-flex h-8 w-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-full text-muted-foreground/72 transition-colors hover:bg-muted/42 hover:text-foreground active:cursor-grabbing";
const CHIP_EDIT_ACTION_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/72 transition-colors hover:bg-muted/42 hover:text-foreground";
const CHIP_PLACEHOLDER_CLASS =
  "pointer-events-none absolute inset-[3px] rounded-full border border-dashed border-border/70 bg-muted/26";
const CHIP_OVERLAY_CLASS =
  "border-border/75 bg-background shadow-[0_18px_30px_-18px_rgba(15,23,42,0.28)]";
const CREATE_ACTION_CLASS = `inline-flex h-8 w-8 items-center justify-center rounded-full border border-foreground/12 bg-foreground/[0.06] text-foreground/82 shadow-none transition-all ${MOTION_CLASS} hover:border-foreground/18 hover:bg-foreground/[0.1] hover:text-foreground`;

const MOBILE_CHIP_LABEL_STYLE = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  overflowWrap: "anywhere",
} satisfies React.CSSProperties;
const MOBILE_CHIP_BUTTON_STYLE = {
  height: "2.5rem",
  minHeight: "2.5rem",
} satisfies React.CSSProperties;

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
  mobileDense?: boolean;
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
  const categoryTintStyle: React.CSSProperties = {
    backgroundColor: hexToRgba(category.color, isOverlay ? 0.13 : 0.1),
    borderColor: hexToRgba(category.color, isOverlay ? 0.3 : 0.22),
    ...style,
  };
  const categoryAccentStyle: React.CSSProperties = {
    color: category.color,
  };
  const categoryActionHoverStyle: React.CSSProperties = {
    color: category.color,
  };

  return (
    <div
      ref={chipRef}
      style={categoryTintStyle}
      className={cn(
        CHIP_SHELL_CLASS,
        "text-foreground/86 hover:brightness-[0.98]",
        isOverlay && CHIP_OVERLAY_CLASS,
        isPlaceholder && "bg-background/80"
      )}
    >
      {isPlaceholder ? (
        <div
          className={CHIP_PLACEHOLDER_CLASS}
          style={{
            borderColor: hexToRgba(category.color, 0.38),
            backgroundColor: hexToRgba(category.color, 0.1),
          }}
        />
      ) : null}

      {interactiveHandle ? (
        <button
          type="button"
          ref={setHandleRef}
          aria-label={`Reordenar categoria ${category.name}`}
          title={`Reordenar categoria ${category.name}`}
          className={cn(CHIP_HANDLE_CLASS, contentHiddenClass)}
          style={categoryAccentStyle}
          {...handleAttributes}
          {...handleListeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      ) : isOverlay || isPlaceholder ? (
        <span
          className={cn(CHIP_HANDLE_CLASS, "cursor-default", contentHiddenClass)}
          aria-hidden="true"
          style={categoryAccentStyle}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      ) : (
        <span className={cn(CHIP_LEADING_SLOT_CLASS, contentHiddenClass)} aria-hidden="true">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: category.color,
            }}
          />
        </span>
      )}

      {isOverlay || isPlaceholder ? (
        <div
          className={cn(
            "flex min-w-0 items-center gap-1.5 pl-1 pr-2 text-[0.78rem] font-medium",
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
          className="flex min-w-0 items-center gap-1.5 pl-1 pr-2 text-[0.78rem] font-medium"
        >
          <span className="truncate">{category.name}</span>
        </button>
      )}

      {isOverlay || isPlaceholder ? (
        <div className={cn("pr-1", contentHiddenClass)}>
          <span className={CHIP_EDIT_ACTION_CLASS} style={categoryActionHoverStyle}>
            <PencilLine className="h-3.5 w-3.5" />
          </span>
        </div>
      ) : onEdit ? (
        <div className="pr-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit?.();
            }}
            aria-label={`Editar categoria ${category.name}`}
            title={`Editar categoria ${category.name}`}
            className={CHIP_EDIT_ACTION_CLASS}
            style={categoryActionHoverStyle}
          >
            <PencilLine className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="pr-1">
          <span
            className={cn(CHIP_EDIT_ACTION_CLASS, "opacity-0")}
            aria-hidden="true"
          >
            <PencilLine className="h-3.5 w-3.5" />
          </span>
        </div>
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
  mobileDense = false,
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
  const barClass = cn(
    mobileDense
      ? "grid w-full grid-cols-2 gap-1.5 min-[430px]:grid-cols-3"
      : compact
        ? "w-full min-h-8 justify-center"
        : "mb-2 min-h-8 justify-center",
    mobileDense ? "" : "flex flex-wrap items-center gap-1.5 sm:gap-2"
  );

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
            title={category.name}
            className={`inline-flex items-center border text-[0.78rem] font-medium shadow-none transition-all ${MOTION_CLASS} ${
              mobileDense
                ? "h-10 w-full justify-start overflow-hidden rounded-[8px] pr-2 text-left"
                : "h-8 overflow-hidden rounded-full"
            } ${
              category.visible
                ? "text-foreground hover:brightness-[0.97]"
                : "bg-background text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
            }`}
            style={{
              ...(mobileDense ? MOBILE_CHIP_BUTTON_STYLE : {}),
              backgroundColor: category.visible
                ? hexToRgba(category.color, 0.1)
                : "hsl(var(--background))",
              borderColor: category.visible
                ? hexToRgba(category.color, 0.2)
                : "hsl(var(--border) / 0.72)",
            }}
          >
            <span
              className={cn(
                mobileDense
                  ? "inline-flex h-8 w-7 shrink-0 items-center justify-center"
                  : CHIP_LEADING_SLOT_CLASS
              )}
              aria-hidden="true"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: category.color,
                  opacity: category.visible ? 0.92 : 0.5,
                }}
              />
            </span>
            <span
              className={`min-w-0 pl-1 pr-3 ${
                mobileDense
                  ? "text-left text-[0.74rem] font-semibold leading-[0.84rem]"
                  : "truncate"
              } ${
                category.visible ? "text-foreground" : "text-muted-foreground"
              }`}
              style={mobileDense ? MOBILE_CHIP_LABEL_STYLE : undefined}
            >
              {category.name}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setCategoriesVisibility(displayedCategoryIds, !allDisplayedVisible)}
          style={mobileDense ? MOBILE_CHIP_BUTTON_STYLE : undefined}
          className={`inline-flex items-center justify-center border px-2.5 text-muted-foreground/80 shadow-none transition-all ${MOTION_CLASS} ${
            mobileDense ? "h-10 w-full rounded-[8px]" : "h-8 rounded-full"
          } ${
            allDisplayedVisible
              ? "border-border bg-background hover:border-border hover:bg-muted hover:text-foreground"
              : "border-border bg-muted text-foreground/85 hover:border-border hover:bg-muted hover:text-foreground"
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
            className={`${CREATE_ACTION_CLASS} ${
              editingProfileId
                ? ""
                : "cursor-not-allowed border-border/55 bg-background/80 text-muted-foreground/55 hover:border-border/55 hover:bg-background/80 hover:text-muted-foreground/55"
            }`}
            aria-label="Criar nova categoria"
            title="Criar nova categoria"
          >
            <Plus className="h-3.5 w-3.5" />
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
