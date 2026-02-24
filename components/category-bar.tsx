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
import type { CategoryItem } from "@/lib/types";

export function CategoryBar({ compact = false }: { compact?: boolean }) {
  const categories = useStore((s) => s.categories);
  const toggleCategoryVisibility = useStore((s) => s.toggleCategoryVisibility);
  const setAllCategoriesVisibility = useStore((s) => s.setAllCategoriesVisibility);
  const setCategoriesOrder = useStore((s) => s.setCategoriesOrder);

  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [dragSourceId, setDragSourceId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = React.useState<CategoryItem[] | null>(null);
  const didDropRef = React.useRef(false);
  const previewOrderRef = React.useRef<CategoryItem[] | null>(null);

  React.useEffect(() => {
    previewOrderRef.current = previewOrder;
  }, [previewOrder]);

  const displayedCategories = previewOrder ?? categories;
  const allVisible = categories.length > 0 && categories.every((c) => c.visible);

  const moveInArray = React.useCallback(
    (arr: CategoryItem[], sourceId: string, targetId: string) => {
      const sourceIndex = arr.findIndex((c) => c.id === sourceId);
      const targetIndex = arr.findIndex((c) => c.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return arr;
      const next = [...arr];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    },
    []
  );

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

  const openEditCategory = (categoryId: string) => {
    setEditingCategoryId(categoryId);
    setIsEditModalOpen(true);
  };

  const commitPreviewOrder = React.useCallback(
    (finalOrder: CategoryItem[] | null) => {
      if (!isEditMode || !finalOrder) return;
      const nextIds = finalOrder.map((c) => c.id);
      const currentIds = categories.map((c) => c.id);
      if (
        nextIds.length === currentIds.length &&
        nextIds.every((id, idx) => id === currentIds[idx])
      ) {
        return;
      }
      setCategoriesOrder(nextIds);
    },
    [categories, isEditMode, setCategoriesOrder]
  );

  const moveCategoryByDelta = React.useCallback(
    (categoryId: string, delta: -1 | 1) => {
      const sourceIndex = categories.findIndex((category) => category.id === categoryId);
      if (sourceIndex === -1) return;
      const targetIndex = sourceIndex + delta;
      if (targetIndex < 0 || targetIndex >= categories.length) return;
      const next = [...categories];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      setCategoriesOrder(next.map((category) => category.id));
      clearDragState();
    },
    [categories, clearDragState, setCategoriesOrder]
  );

  const handleToggleEditMode = (enabled: boolean) => {
    if (!enabled) {
      clearDragState();
    }
    setIsEditMode(enabled);
  };

  return (
    <div className={`${compact ? "" : "mb-4"} flex items-center gap-2`}>
      {displayedCategories.map((c) => {
        const categoryIndex = categories.findIndex((category) => category.id === c.id);
        const canMoveLeft = categoryIndex > 0;
        const canMoveRight = categoryIndex >= 0 && categoryIndex < categories.length - 1;

        return (
          <div
            key={c.id}
            draggable={isEditMode}
            role={isEditMode ? undefined : "button"}
            tabIndex={isEditMode ? undefined : 0}
            onDragStart={(e) => {
              if (!isEditMode) return;
              didDropRef.current = false;
              setDragSourceId(c.id);
              setDragOverId(c.id);
              setPreviewOrder(categories);
              previewOrderRef.current = categories;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnter={() => {
              if (!isEditMode || !dragSourceId || dragSourceId === c.id) return;
              setDragOverId(c.id);
              const nextOrder = moveInArray(
                previewOrderRef.current ?? categories,
                dragSourceId,
                c.id
              );
              setPreviewOrder(nextOrder);
              previewOrderRef.current = nextOrder;
            }}
            onDragOver={(e) => {
              if (!isEditMode) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              if (!isEditMode) return;
              e.preventDefault();
              didDropRef.current = true;
              commitPreviewOrder(previewOrderRef.current ?? previewOrder ?? categories);
              clearDragState({ resetDidDrop: false });
            }}
            onDragEnd={() => {
              if (!didDropRef.current) {
                commitPreviewOrder(previewOrderRef.current ?? previewOrder ?? categories);
              }
              clearDragState();
            }}
            onClick={() => {
              if (isEditMode) return;
              toggleCategoryVisibility(c.id);
            }}
            onKeyDown={(e) => {
              if (isEditMode) return;
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              toggleCategoryVisibility(c.id);
            }}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs text-white transition-opacity ${
              c.visible ? "opacity-100" : "opacity-40"
            } ${isEditMode ? "cursor-grab" : "cursor-pointer"} ${
              isEditMode && dragOverId === c.id ? "ring-2 ring-white/50" : ""
            }`}
            style={{ backgroundColor: c.color }}
          >
            {isEditMode ? (
              <GripVertical size={12} />
            ) : (
              <span className="h-2 w-2 rounded-full bg-white/80" />
            )}
            <span className="font-medium">{c.name}</span>
            {isEditMode ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    moveCategoryByDelta(c.id, -1);
                  }}
                  disabled={!canMoveLeft}
                  className="ml-1 inline-flex rounded p-0.5 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Mover categoria ${c.name} para esquerda`}
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    moveCategoryByDelta(c.id, 1);
                  }}
                  disabled={!canMoveRight}
                  className="inline-flex rounded p-0.5 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Mover categoria ${c.name} para direita`}
                >
                  <ChevronRight size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openEditCategory(c.id);
                  }}
                  className="inline-flex rounded p-0.5 hover:bg-white/20"
                  aria-label={`Editar categoria ${c.name}`}
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
          <Button variant="secondary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
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
            title={allVisible ? "Ocultar todas" : "Mostrar todas"}
            onClick={() => setAllCategoriesVisibility(!allVisible)}
          >
            {allVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleToggleEditMode(true)}>
            Editar
          </Button>
        </>
      )}

      <CategoryManager
        mode="create"
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
      <CategoryManager
        mode="edit"
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        categoryId={editingCategoryId ?? undefined}
      />
    </div>
  );
}
