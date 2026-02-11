"use client";

import * as React from "react";
import { Check, Eye, EyeOff, GripVertical, Pencil, Plus } from "lucide-react";
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

  const displayedCategories = previewOrder ?? categories;
  const allVisible = categories.length > 0 && categories.every((c) => c.visible);

  const moveInArray = (arr: CategoryItem[], sourceId: string, targetId: string) => {
    const sourceIndex = arr.findIndex((c) => c.id === sourceId);
    const targetIndex = arr.findIndex((c) => c.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return arr;
    const next = [...arr];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
  };

  const openEditCategory = (categoryId: string) => {
    setEditingCategoryId(categoryId);
    setIsEditModalOpen(true);
  };

  const commitPreviewOrder = (finalOrder: CategoryItem[] | null) => {
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
  };

  const commitByTarget = (sourceId: string | null, targetId: string | null) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    commitPreviewOrder(moveInArray(categories, sourceId, targetId));
  };

  return (
    <div className={`${compact ? "" : "mb-4"} flex items-center gap-2`}>
      {displayedCategories.map((c) => (
        <button
          key={c.id}
          type="button"
          draggable={isEditMode}
          onDragStart={() => {
            if (!isEditMode) return;
            setDragSourceId(c.id);
            setDragOverId(c.id);
            setPreviewOrder(categories);
          }}
          onDragEnter={() => {
            if (!isEditMode || !dragSourceId || dragSourceId === c.id) return;
            setDragOverId(c.id);
            setPreviewOrder((prev) => moveInArray(prev ?? categories, dragSourceId, c.id));
          }}
          onDragOver={(e) => {
            if (!isEditMode) return;
            e.preventDefault();
          }}
          onDrop={() => {
            if (!isEditMode) return;
            commitByTarget(dragSourceId, c.id);
            setDragSourceId(null);
            setDragOverId(null);
            setPreviewOrder(null);
          }}
          onDragEnd={() => {
            commitByTarget(dragSourceId, dragOverId);
            setDragSourceId(null);
            setDragOverId(null);
            setPreviewOrder(null);
          }}
          onClick={() => {
            if (isEditMode) return;
            toggleCategoryVisibility(c.id);
          }}
          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs text-white transition-opacity ${
            c.visible ? "opacity-100" : "opacity-40"
          } ${isEditMode ? "cursor-grab" : "cursor-pointer"} ${isEditMode && dragOverId === c.id ? "ring-2 ring-white/50" : ""}`}
          style={{ backgroundColor: c.color }}
        >
          {isEditMode ? (
            <GripVertical size={12} />
          ) : (
            <span className="h-2 w-2 rounded-full bg-white/80" />
          )}
          <span className="font-medium">{c.name}</span>
          {isEditMode ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                openEditCategory(c.id);
              }}
              className="ml-1 inline-flex rounded p-0.5 hover:bg-white/20"
            >
              <Pencil size={12} />
            </span>
          ) : null}
        </button>
      ))}

      {isEditMode ? (
        <>
          <Button variant="secondary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={14} />
          </Button>
          <Button variant="default" size="sm" onClick={() => setIsEditMode(false)}>
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
          <Button variant="ghost" size="sm" onClick={() => setIsEditMode(true)}>
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
