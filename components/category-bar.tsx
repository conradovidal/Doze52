"use client";

import * as React from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { CategoryManager } from "./category-manager";
import type { AnchorPoint, CategoryItem } from "@/lib/types";

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
  onGlobalEditModeChange?: (enabled: boolean) => void;
};

export function CategoryBar({
  compact = false,
  isGlobalEditMode = false,
  onGlobalEditModeChange,
}: CategoryBarProps) {
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
  const didDropRef = React.useRef(false);
  const previewOrderRef = React.useRef<CategoryItem[] | null>(null);
  const isEditMode = isGlobalEditMode;

  React.useEffect(() => {
    previewOrderRef.current = previewOrder;
  }, [previewOrder]);

  const activeProfileIds = React.useMemo(
    () => new Set(selectedProfileIds),
    [selectedProfileIds]
  );

  const baseCategories = React.useMemo(
    () => categories.filter((category) => activeProfileIds.has(category.profileId)),
    [categories, activeProfileIds]
  );

  const editableProfileId = selectedProfileIds[0] ?? null;

  const canEditCategories = Boolean(editableProfileId);

  const displayedCategories = React.useMemo(() => {
    if (previewOrder) return previewOrder;
    if (isEditMode && editableProfileId) {
      return baseCategories.filter((category) => category.profileId === editableProfileId);
    }
    return baseCategories;
  }, [baseCategories, editableProfileId, isEditMode, previewOrder]);

  const allVisible =
    displayedCategories.length > 0 && displayedCategories.every((category) => category.visible);

  const clearDragState = React.useCallback(
    (options?: { resetDidDrop?: boolean }) => {
      setDragSourceId(null);
      setDragOverId(null);
      setPreviewOrder(null);
      previewOrderRef.current = null;
      if (options?.resetDidDrop ?? true) {
        didDropRef.current = false;
      }
    },
    []
  );

  React.useEffect(() => {
    if (!isEditMode) {
      clearDragState();
    }
  }, [isEditMode, clearDragState]);

  const openEditCategory = (categoryId: string, anchorPoint?: AnchorPoint) => {
    setEditingCategoryId(categoryId);
    setEditAnchorPoint(anchorPoint);
    setIsEditModalOpen(true);
  };

  const commitPreviewOrder = React.useCallback(
    (finalOrder: CategoryItem[] | null) => {
      if (!isEditMode || !finalOrder || !editableProfileId) return;

      const sourceIds =
        categories
          .filter((category) => category.profileId === editableProfileId)
          .map((category) => category.id) ?? [];
      const nextIds = finalOrder.map((category) => category.id);
      const didChange =
        sourceIds.length === nextIds.length &&
        sourceIds.some((id, index) => id !== nextIds[index]);
      if (!didChange) {
        return;
      }

      const fullOrderIds = applyProfileOrderToAll(categories, editableProfileId, finalOrder);
      setCategoriesOrder(fullOrderIds);
    },
    [categories, editableProfileId, isEditMode, setCategoriesOrder]
  );

  const moveCategoryByDelta = React.useCallback(
    (categoryId: string, delta: -1 | 1) => {
      if (!editableProfileId) return;
      const profileCategories = categories.filter(
        (category) => category.profileId === editableProfileId
      );
      const sourceIndex = profileCategories.findIndex((category) => category.id === categoryId);
      if (sourceIndex === -1) return;
      const targetIndex = sourceIndex + delta;
      if (targetIndex < 0 || targetIndex >= profileCategories.length) return;
      const next = [...profileCategories];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      const fullOrderIds = applyProfileOrderToAll(categories, editableProfileId, next);
      setCategoriesOrder(fullOrderIds);
      clearDragState();
    },
    [categories, clearDragState, editableProfileId, setCategoriesOrder]
  );

  const handleToggleEditMode = (enabled: boolean) => {
    if (!enabled) {
      clearDragState();
    }
    if (enabled && !canEditCategories) return;
    onGlobalEditModeChange?.(enabled);
  };

  return (
    <div
      className={`${compact ? "w-full justify-center" : "mb-4 justify-center"} flex flex-wrap items-center gap-2`}
    >
      {displayedCategories.map((category) => {
        const profileCategories = editableProfileId
          ? categories.filter((entry) => entry.profileId === editableProfileId)
          : categories;
        const categoryIndex = profileCategories.findIndex((entry) => entry.id === category.id);
        const canMoveLeft = categoryIndex > 0;
        const canMoveRight =
          categoryIndex >= 0 && categoryIndex < profileCategories.length - 1;

        return (
          <div
            key={category.id}
            draggable={isEditMode && Boolean(editableProfileId)}
            role={isEditMode ? undefined : "button"}
            tabIndex={isEditMode ? undefined : 0}
            onDragStart={(event) => {
              if (!isEditMode) return;
              didDropRef.current = false;
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
              didDropRef.current = true;
              commitPreviewOrder(
                previewOrderRef.current ?? previewOrder ?? displayedCategories
              );
              clearDragState({ resetDidDrop: false });
            }}
            onDragEnd={() => {
              if (!didDropRef.current) {
                commitPreviewOrder(
                  previewOrderRef.current ?? previewOrder ?? displayedCategories
                );
              }
              clearDragState();
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
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs text-white transition-opacity ${
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
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveCategoryByDelta(category.id, -1);
                  }}
                  disabled={!canMoveLeft}
                  className="ml-1 inline-flex rounded p-0.5 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Mover categoria ${category.name} para esquerda`}
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveCategoryByDelta(category.id, 1);
                  }}
                  disabled={!canMoveRight}
                  className="inline-flex rounded p-0.5 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Mover categoria ${category.name} para direita`}
                >
                  <ChevronRight size={12} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    openEditCategory(category.id, { x: rect.right, y: rect.bottom });
                  }}
                  className="inline-flex rounded p-0.5 hover:bg-white/20"
                  aria-label={`Editar categoria ${category.name}`}
                >
                  <Pencil size={12} />
                </button>
              </>
            ) : null}
          </div>
        );
      })}

      {isEditMode ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setCreateAnchorPoint({ x: rect.right, y: rect.bottom });
              setIsCreateModalOpen(true);
            }}
            disabled={!editableProfileId}
          >
            <Plus size={14} />
          </Button>
          <Button variant="default" size="sm" onClick={() => handleToggleEditMode(false)}>
            <Check size={14} className="mr-1" />
            Done
          </Button>
        </>
      ) : (
        <>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleEditMode(true)}
            disabled={!canEditCategories}
            title={
              !canEditCategories
                ? "Selecione apenas um perfil para editar categorias"
                : undefined
            }
            aria-label="Editar categorias"
          >
            <Pencil size={14} />
          </Button>
        </>
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
