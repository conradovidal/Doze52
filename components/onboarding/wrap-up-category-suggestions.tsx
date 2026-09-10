"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import { getCategoryColorToken } from "@/lib/category-palette";
import {
  dispatchGuidedOnboarding,
  type WrapUpCategorySuggestion,
} from "@/lib/onboarding";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const SUGGESTION_DRAG_MIME = "application/x-doze52-category-suggestion";
const PROMOTED_CATEGORY_DRAG_MIME = "application/x-doze52-promoted-category";
const CHIP_CLASS =
  "inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-[10px] border pl-1.5 pr-3 text-[0.78rem] font-semibold shadow-none transition-[background-color,opacity,transform] duration-[160ms] ease-out";

function SuggestionChip({ suggestion, onAdopt, onDragStart, onDragEnd }: {
  suggestion: WrapUpCategorySuggestion;
  onAdopt: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { mode: themeMode } = useTheme();
  const colorToken = getCategoryColorToken(suggestion.color, themeMode);
  const [isDragging, setIsDragging] = React.useState(false);
  return (
    <button
      type="button"
      draggable
      onClick={onAdopt}
      onDragStart={(event) => {
        event.dataTransfer.setData(SUGGESTION_DRAG_MIME, suggestion.id);
        event.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => { setIsDragging(false); onDragEnd(); }}
      style={{
        backgroundColor: colorToken.soft,
        borderColor: colorToken.border,
        color: colorToken.text,
        opacity: isDragging ? 0.35 : 1,
        transform: isDragging ? "scale(0.96)" : "scale(1)",
      }}
      className={cn(CHIP_CLASS, "cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45")}
      aria-label={`Adicionar categoria ${suggestion.name}`}
    >
      <GripVertical className="size-3.5 shrink-0" aria-hidden="true" />
      {suggestion.name}
    </button>
  );
}

export function WrapUpCategorySuggestions({ profileId, suggestions, suggestionCategoryIds = {}, cap, children }: {
  profileId?: string;
  suggestions: WrapUpCategorySuggestion[];
  suggestionCategoryIds?: Record<string, string>;
  cap: number | null;
  children: React.ReactNode;
}) {
  const categories = useStore((state) => state.categories);
  const events = useStore((state) => state.events);
  const createCategory = useStore((state) => state.createCategory);
  const updateCategory = useStore((state) => state.updateCategory);
  const deleteCategory = useStore((state) => state.deleteCategory);
  const [returnedSuggestionIds, setReturnedSuggestionIds] = React.useState<string[]>([]);
  const [dragOverSuggestionId, setDragOverSuggestionId] = React.useState<string | null>(null);
  const draggingSuggestionIdRef = React.useRef<string | null>(null);

  const profileCategories = React.useMemo(
    () => categories.filter((category) => !profileId || category.profileId === profileId),
    [categories, profileId]
  );
  const suggestionIdByCategoryId = React.useMemo(() => {
    const entries = new Map<string, string>();
    Object.entries(suggestionCategoryIds).forEach(([suggestionId, categoryId]) => entries.set(categoryId, suggestionId));
    profileCategories.forEach((category) => {
      if (category.onboardingSuggestionId) entries.set(category.id, category.onboardingSuggestionId);
    });
    return entries;
  }, [profileCategories, suggestionCategoryIds]);
  const promotedCategoryIds = React.useMemo(() => new Set(suggestionIdByCategoryId.keys()), [suggestionIdByCategoryId]);
  const adoptedSuggestionIds = React.useMemo(() => new Set(suggestionIdByCategoryId.values()), [suggestionIdByCategoryId]);

  React.useEffect(() => {
    Object.entries(suggestionCategoryIds).forEach(([suggestionId, categoryId]) => {
      const category = profileCategories.find((item) => item.id === categoryId);
      if (category && category.onboardingSuggestionId !== suggestionId) {
        updateCategory(categoryId, { onboardingSuggestionId: suggestionId });
      }
    });
  }, [profileCategories, suggestionCategoryIds, updateCategory]);

  const persistMapping = React.useCallback((entries: Record<string, string>) => {
    dispatchGuidedOnboarding({ type: "set_wrap_up_suggestions", entries });
  }, []);

  const demoteCategory = React.useCallback((categoryId: string) => {
    const suggestionId = suggestionIdByCategoryId.get(categoryId);
    if (!suggestionId || events.some((event) => event.categoryId === categoryId)) return;
    if (!deleteCategory({ categoryId, strategy: { type: "delete-events" } })) return;
    const nextMapping = { ...suggestionCategoryIds };
    delete nextMapping[suggestionId];
    persistMapping(nextMapping);
    setReturnedSuggestionIds((current) => [suggestionId, ...current.filter((id) => id !== suggestionId)]);
  }, [deleteCategory, events, persistMapping, suggestionCategoryIds, suggestionIdByCategoryId]);

  const adoptSuggestion = React.useCallback((suggestionId: string) => {
    const suggestion = suggestions.find((item) => item.id === suggestionId);
    if (!suggestion || adoptedSuggestionIds.has(suggestionId) || !profileId) return;
    const isAtCap = cap != null && profileCategories.length >= cap;
    const thirdCategory = profileCategories[2];
    const replaceCategoryId = isAtCap && thirdCategory && promotedCategoryIds.has(thirdCategory.id) &&
      !events.some((event) => event.categoryId === thirdCategory.id) ? thirdCategory.id : undefined;
    if (isAtCap && !replaceCategoryId) return;
    const displacedSuggestionId = replaceCategoryId ? suggestionIdByCategoryId.get(replaceCategoryId) : undefined;
    const newCategoryId = createCategory({
      name: suggestion.name,
      color: suggestion.color,
      profileId,
      onboardingSuggestionId: suggestion.id,
      replaceCategoryId,
    });
    if (!newCategoryId) return;
    const nextMapping = { ...suggestionCategoryIds };
    if (displacedSuggestionId) delete nextMapping[displacedSuggestionId];
    nextMapping[suggestion.id] = newCategoryId;
    persistMapping(nextMapping);
    setReturnedSuggestionIds((current) => [
      ...(displacedSuggestionId ? [displacedSuggestionId] : []),
      ...current.filter((id) => id !== displacedSuggestionId && id !== suggestion.id),
    ]);
  }, [adoptedSuggestionIds, cap, createCategory, events, persistMapping, profileCategories, profileId, promotedCategoryIds, suggestionCategoryIds, suggestionIdByCategoryId, suggestions]);

  const availableSuggestions = React.useMemo(() => {
    const priority = new Map(returnedSuggestionIds.map((id, index) => [id, index]));
    return suggestions.filter((suggestion) => !adoptedSuggestionIds.has(suggestion.id)).sort((left, right) => {
      const a = priority.get(left.id); const b = priority.get(right.id);
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return a - b;
    });
  }, [adoptedSuggestionIds, returnedSuggestionIds, suggestions]);

  const dragOverSuggestion = dragOverSuggestionId ? suggestions.find((item) => item.id === dragOverSuggestionId) : undefined;
  const thirdCategory = profileCategories[2];
  const canReplaceThird = Boolean(thirdCategory && promotedCategoryIds.has(thirdCategory.id) && !events.some((event) => event.categoryId === thirdCategory.id));
  const atCap = cap != null && profileCategories.length >= cap;
  const previewGhostSuggestion = dragOverSuggestion
    ? { name: dragOverSuggestion.name, color: dragOverSuggestion.color }
    : !atCap ? { name: "Arraste aqui", dashed: true } : null;
  const previewEvictingCategoryId = dragOverSuggestion && atCap && canReplaceThird ? thirdCategory?.id : undefined;

  const childWithPreview = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{
        previewGhostSuggestion?: { name: string; color?: string; dashed?: boolean } | null;
        previewEvictingCategoryId?: string;
        promotedCategoryIds?: ReadonlySet<string>;
        onDemotePromotedCategory?: (categoryId: string) => void;
        onPromotedCategoryDragStart?: (event: React.DragEvent<HTMLButtonElement>, categoryId: string) => void;
      }>, {
        previewGhostSuggestion,
        previewEvictingCategoryId,
        promotedCategoryIds,
        onDemotePromotedCategory: demoteCategory,
        onPromotedCategoryDragStart: (event, categoryId) => {
          event.dataTransfer.setData(PROMOTED_CATEGORY_DRAG_MIME, categoryId);
          event.dataTransfer.effectAllowed = "move";
        },
      })
    : children;

  return (
    <div>
      <div
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes(SUGGESTION_DRAG_MIME)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragOverSuggestionId(draggingSuggestionIdRef.current);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverSuggestionId(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          const suggestionId = event.dataTransfer.getData(SUGGESTION_DRAG_MIME);
          setDragOverSuggestionId(null);
          if (suggestionId) adoptSuggestion(suggestionId);
        }}
      >
        {childWithPreview}
      </div>

      <div
        className="mt-4 border-t border-border/55 pt-4"
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes(PROMOTED_CATEGORY_DRAG_MIME)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const categoryId = event.dataTransfer.getData(PROMOTED_CATEGORY_DRAG_MIME);
          if (categoryId) demoteCategory(categoryId);
        }}
      >
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/75">Sugestões</p>
        <p className="mt-1 text-xs leading-4 text-muted-foreground">Arraste para cima ou use Enter para adicionar. Só escolhas deste guia podem voltar para cá.</p>
        <div className="mt-2.5 flex min-h-8 flex-wrap gap-2">
          {availableSuggestions.map((suggestion) => (
            <SuggestionChip
              key={suggestion.id}
              suggestion={suggestion}
              onAdopt={() => adoptSuggestion(suggestion.id)}
              onDragStart={() => { draggingSuggestionIdRef.current = suggestion.id; }}
              onDragEnd={() => { draggingSuggestionIdRef.current = null; setDragOverSuggestionId(null); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
