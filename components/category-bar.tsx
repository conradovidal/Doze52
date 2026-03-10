"use client";

import * as React from "react";
import { Eye, EyeOff, GripVertical, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useFlipReorder } from "@/lib/use-flip-reorder";
import { CategoryManager } from "./category-manager";
import type { AnchorPoint, CategoryItem } from "@/lib/types";

const MOBILE_LONG_PRESS_MS = 300;
const MOTION_CLASS = "duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
const ADD_BUTTON_CLASS =
  "h-8 w-8 rounded-full border-neutral-300 bg-white p-0 text-neutral-700 shadow-sm hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800";

const moveInArray = (arr: CategoryItem[], sourceId: string, targetId: string) => {
  const sourceIndex = arr.findIndex((c) => c.id === sourceId);
  const targetIndex = arr.findIndex((c) => c.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return arr;
  const next = [...arr];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

const applyProfileOrderToAll = (
  allCategories: CategoryItem[],
  profileId: string,
  orderedInProfile: CategoryItem[]
) => {
  let profileCursor = 0;
  const nextCategories = allCategories.map((category) => {
    if (category.profileId !== profileId) return category;
    const replacement = orderedInProfile[profileCursor] ?? category;
    profileCursor += 1;
    return replacement;
  });
  return nextCategories.map((category) => category.id);
};

type CategoryBarProps = {
  compact?: boolean;
  isGlobalEditMode?: boolean;
};

export function CategoryBar({ compact = false, isGlobalEditMode = false }: CategoryBarProps) {
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const categories = useStore((s) => s.categories);
  const toggleCategoryVisibility = useStore((s) => s.toggleCategoryVisibility);
  const updateCategory = useStore((s) => s.updateCategory);
  const setCategoriesOrder = useStore((s) => s.setCategoriesOrder);

  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [createAnchorPoint, setCreateAnchorPoint] = React.useState<AnchorPoint | undefined>(
    undefined
  );
  const [editAnchorPoint, setEditAnchorPoint] = React.useState<AnchorPoint | undefined>(
    undefined
  );
  const [dragSourceId, setDragSourceId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = React.useState<CategoryItem[] | null>(null);

  const longPressTimerRef = React.useRef<number | null>(null);
  const activePointerIdRef = React.useRef<number | null>(null);
  const isTouchDraggingRef = React.useRef(false);
  const previewOrderRef = React.useRef<CategoryItem[] | null>(null);

  React.useEffect(() => {
    previewOrderRef.current = previewOrder;
  }, [previewOrder]);

  const isEditMode = isGlobalEditMode;
  const activeProfileIds = React.useMemo(
    () => new Set(selectedProfileIds),
    [selectedProfileIds]
  );
  const baseCategories = React.useMemo(
    () => categories.filter((category) => activeProfileIds.has(category.profileId)),
    [categories, activeProfileIds]
  );
  const editableProfileId = selectedProfileIds[0] ?? null;
  const displayedCategories = React.useMemo(() => {
    if (previewOrder) return previewOrder;
    if (isEditMode && editableProfileId) {
      return baseCategories.filter((category) => category.profileId === editableProfileId);
    }
    return baseCategories;
  }, [baseCategories, editableProfileId, isEditMode, previewOrder]);
  const registerCategoryNode = useFlipReorder(
    displayedCategories.map((category) => category.id),
    { durationMs: 160 }
  );
  const allVisible =
    displayedCategories.length > 0 && displayedCategories.every((category) => category.visible);

  const clearLongPressTimer = React.useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const clearDragState = React.useCallback(() => {
    clearLongPressTimer();
    activePointerIdRef.current = null;
    isTouchDraggingRef.current = false;
    previewOrderRef.current = null;
    setDragSourceId(null);
    setDragOverId(null);
    setPreviewOrder(null);
  }, [clearLongPressTimer]);

  React.useEffect(() => {
    if (!isEditMode) {
      clearDragState();
    }
  }, [isEditMode, clearDragState]);

  React.useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const resolveCategoryIdFromPoint = React.useCallback((x: number, y: number) => {
    if (typeof document === "undefined") return null;
    const node = document.elementFromPoint(x, y) as HTMLElement | null;
    return node?.closest<HTMLElement>("[data-category-chip-id]")?.dataset.categoryChipId ?? null;
  }, []);

  const commitPreviewOrder = React.useCallback(
    (finalOrder: CategoryItem[] | null) => {
      if (!isEditMode || !finalOrder || !editableProfileId) return;
      const sourceIds = categories
        .filter((category) => category.profileId === editableProfileId)
        .map((category) => category.id);
      const nextIds = finalOrder.map((category) => category.id);
      const didChange =
        sourceIds.length === nextIds.length &&
        sourceIds.some((id, index) => id !== nextIds[index]);
      if (!didChange) return;
      const fullOrderIds = applyProfileOrderToAll(categories, editableProfileId, finalOrder);
      setCategoriesOrder(fullOrderIds);
    },
    [categories, editableProfileId, isEditMode, setCategoriesOrder]
  );

  const openEditCategory = (categoryId: string, anchorPoint?: AnchorPoint) => {
    setEditingCategoryId(categoryId);
    setEditAnchorPoint(anchorPoint);
    setIsEditModalOpen(true);
  };

  return (
    <div
      className={`${compact ? "w-full min-h-8 justify-center" : "mb-2 min-h-8 justify-center"} flex flex-wrap items-center gap-2`}
    >
      {displayedCategories.map((category) => (
        <div
          key={category.id}
          ref={(node) => registerCategoryNode(category.id, node)}
          data-category-chip-id={category.id}
          draggable={isEditMode && Boolean(editableProfileId)}
          role={isEditMode ? undefined : "button"}
          tabIndex={isEditMode ? undefined : 0}
          onDragStart={(event) => {
            if (!isEditMode) return;
            setDragSourceId(category.id);
            setDragOverId(category.id);
            setPreviewOrder(displayedCategories);
            previewOrderRef.current = displayedCategories;
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragEnter={() => {
            if (!isEditMode || !dragSourceId || dragSourceId === category.id) return;
            setDragOverId(category.id);
            const nextOrder = moveInArray(
              previewOrderRef.current ?? displayedCategories,
              dragSourceId,
              category.id
            );
            setPreviewOrder(nextOrder);
            previewOrderRef.current = nextOrder;
          }}
          onDragOver={(event) => {
            if (!isEditMode) return;
            event.preventDefault();
          }}
          onDrop={(event) => {
            if (!isEditMode) return;
            event.preventDefault();
            commitPreviewOrder(previewOrderRef.current ?? previewOrder ?? displayedCategories);
            clearDragState();
          }}
          onDragEnd={() => {
            clearDragState();
          }}
          onPointerDown={(event) => {
            if (!isEditMode || event.pointerType !== "touch") return;
            activePointerIdRef.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            clearLongPressTimer();
            longPressTimerRef.current = window.setTimeout(() => {
              isTouchDraggingRef.current = true;
              setDragSourceId(category.id);
              setDragOverId(category.id);
              setPreviewOrder(displayedCategories);
              previewOrderRef.current = displayedCategories;
            }, MOBILE_LONG_PRESS_MS);
          }}
          onPointerMove={(event) => {
            if (!isEditMode || event.pointerType !== "touch") return;
            if (activePointerIdRef.current !== event.pointerId) return;
            if (!isTouchDraggingRef.current || !dragSourceId) return;
            event.preventDefault();
            const targetId = resolveCategoryIdFromPoint(event.clientX, event.clientY);
            if (!targetId || targetId === dragOverId) return;
            setDragOverId(targetId);
            const nextOrder = moveInArray(
              previewOrderRef.current ?? displayedCategories,
              dragSourceId,
              targetId
            );
            setPreviewOrder(nextOrder);
            previewOrderRef.current = nextOrder;
          }}
          onPointerUp={(event) => {
            if (!isEditMode || event.pointerType !== "touch") return;
            if (activePointerIdRef.current !== event.pointerId) return;
            clearLongPressTimer();
            try {
              event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
              // no-op
            }
            if (isTouchDraggingRef.current) {
              commitPreviewOrder(previewOrderRef.current ?? previewOrder ?? displayedCategories);
            }
            clearDragState();
          }}
          onPointerCancel={(event) => {
            if (!isEditMode || event.pointerType !== "touch") return;
            if (activePointerIdRef.current !== event.pointerId) return;
            clearDragState();
          }}
          onContextMenu={(event) => {
            if (isEditMode) {
              event.preventDefault();
            }
          }}
          onClick={() => {
            if (isEditMode) return;
            toggleCategoryVisibility(category.id);
          }}
          onKeyDown={(event) => {
            if (isEditMode) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            toggleCategoryVisibility(category.id);
          }}
          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs text-white transition-colors ${MOTION_CLASS} ${
            category.visible ? "opacity-100" : "opacity-40"
          } ${isEditMode ? "cursor-grab" : "cursor-pointer"} ${
            isEditMode && dragOverId === category.id ? "ring-2 ring-white/50" : ""
          }`}
          style={{ backgroundColor: category.color }}
        >
          {isEditMode ? (
            <GripVertical size={12} />
          ) : (
            <span className="h-2 w-2 rounded-full bg-white/80" />
          )}
          <span className="font-medium">{category.name}</span>
          {isEditMode ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                openEditCategory(category.id, { x: rect.right, y: rect.bottom });
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onDragStart={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              className="ml-1 inline-flex rounded p-0.5 hover:bg-white/20"
              aria-label={`Editar categoria ${category.name}`}
            >
              <Pencil size={12} />
            </button>
          ) : null}
        </div>
      ))}

      {isEditMode ? (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setCreateAnchorPoint({ x: rect.right, y: rect.bottom });
            setIsCreateModalOpen(true);
          }}
          disabled={!editableProfileId}
          className={ADD_BUTTON_CLASS}
        >
          <Plus size={14} />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          title={allVisible ? "Ocultar categorias visiveis" : "Mostrar categorias visiveis"}
          onClick={() => {
            displayedCategories.forEach((category) => {
              if (category.visible !== !allVisible) {
                updateCategory(category.id, { visible: !allVisible });
              }
            });
          }}
          disabled={displayedCategories.length === 0}
        >
          {allVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </Button>
      )}

      <CategoryManager
        mode="create"
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          setIsCreateModalOpen(open);
          if (!open) {
            setCreateAnchorPoint(undefined);
          }
        }}
        profileId={editableProfileId ?? undefined}
        anchorPoint={createAnchorPoint}
      />
      <CategoryManager
        mode="edit"
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) {
            setEditAnchorPoint(undefined);
          }
        }}
        categoryId={editingCategoryId ?? undefined}
        anchorPoint={editAnchorPoint}
      />
    </div>
  );
}
