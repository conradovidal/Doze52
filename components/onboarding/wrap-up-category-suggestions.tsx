"use client";

import * as React from "react";
import { Check, GripVertical } from "lucide-react";
import { getCategoryColorToken } from "@/lib/category-palette";
import type { WrapUpCategorySuggestion } from "@/lib/onboarding";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const DRAG_MIME_TYPE = "application/x-doze52-category-suggestion";

const CHIP_CLASS =
  "inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-[10px] border pl-1.5 pr-3 text-[0.78rem] font-semibold shadow-none transition-all duration-200 ease-out";

function SuggestionChip({
  suggestion,
  adopted,
  onDragStart,
  onDragEnd,
}: {
  suggestion: WrapUpCategorySuggestion;
  adopted: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { mode: themeMode } = useTheme();
  const colorToken = getCategoryColorToken(suggestion.color, themeMode);
  const [isDragging, setIsDragging] = React.useState(false);

  return (
    <button
      type="button"
      draggable={!adopted}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_MIME_TYPE, suggestion.id);
        event.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      disabled={adopted}
      style={{
        backgroundColor: colorToken.soft,
        borderColor: colorToken.border,
        color: colorToken.text,
        opacity: adopted ? 0.55 : isDragging ? 0.35 : 1,
        transform: isDragging ? "scale(0.96)" : "scale(1)",
      }}
      className={cn(
        CHIP_CLASS,
        adopted ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
      )}
      aria-label={
        adopted
          ? `${suggestion.name}, já adicionada`
          : `Arraste ${suggestion.name} para adicionar essa categoria`
      }
    >
      {adopted ? (
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <GripVertical className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      {suggestion.name}
    </button>
  );
}

// Tempo do "encaixe": mantém o card que está saindo com a classe de eviction
// (encolher + esmaecer, ver isEvicting em category-bar.tsx) por um instante
// antes de de fato trocar os dados, para a saída se ler como uma animação e
// não como um corte seco.
const SWAP_TRANSITION_MS = 180;

export function WrapUpCategorySuggestions({
  profileId,
  suggestions,
  cap,
  onRemoveCategory,
  children,
}: {
  profileId?: string;
  suggestions: WrapUpCategorySuggestion[];
  cap: number | null;
  // Remove uma categoria existente, incluindo as vindas de um calendário
  // pronto (ex.: Feriados) — o `deleteCategory` do store recusa essas por
  // design, então quem chama precisa saber lidar com o caminho de remoção
  // de calendário. Sem isso, cai no `deleteCategory` comum (não remove
  // calendários prontos).
  onRemoveCategory?: (categoryId: string) => boolean;
  children: React.ReactNode;
}) {
  const categories = useStore((s) => s.categories);
  const createCategory = useStore((s) => s.createCategory);
  const deleteCategoryFallback = useStore((s) => s.deleteCategory);
  const removeCategory = React.useCallback(
    (categoryId: string) =>
      onRemoveCategory
        ? onRemoveCategory(categoryId)
        : deleteCategoryFallback({
            categoryId,
            strategy: { type: "delete-events" },
          }),
    [onRemoveCategory, deleteCategoryFallback]
  );

  // Qualquer categoria do perfil pode ser trocada agora — não só as
  // adotadas por aqui: se a 3a posição for uma categoria criada durante a
  // prática guiada (não uma sugestão), ela também sai quando uma nova
  // sugestão é arrastada para cima.
  const profileCategories = React.useMemo(
    () =>
      categories.filter(
        (category) => !profileId || category.profileId === profileId
      ),
    [categories, profileId]
  );
  const [adopted, setAdopted] = React.useState<
    { suggestionId: string; categoryId: string }[]
  >([]);
  const [dragOverSuggestionId, setDragOverSuggestionId] = React.useState<
    string | null
  >(null);
  const [pendingEvictingCategoryId, setPendingEvictingCategoryId] =
    React.useState<string | null>(null);
  const [enteringCategoryId, setEnteringCategoryId] = React.useState<
    string | null
  >(null);
  const dragCounterRef = React.useRef(0);
  const draggingSuggestionIdRef = React.useRef<string | null>(null);
  const enteringTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (enteringTimeoutRef.current != null) {
        window.clearTimeout(enteringTimeoutRef.current);
      }
    },
    []
  );

  const atCap = cap != null && profileCategories.length >= cap;
  const lastCategoryId =
    profileCategories[profileCategories.length - 1]?.id;

  const adoptSuggestion = React.useCallback(
    (suggestionId: string) => {
      const suggestion = suggestions.find((item) => item.id === suggestionId);
      if (!suggestion) return;
      if (adopted.some((entry) => entry.suggestionId === suggestion.id)) return;

      const evictingCategoryId = atCap ? lastCategoryId : undefined;

      const commitSwap = () => {
        // Se a remoção falhar (ex.: algum bloqueio do store que não
        // previmos), não cria a nova categoria por cima — senão o limite
        // vira decoração: a contagem só cresce e nunca mais tromba no cap.
        if (evictingCategoryId && !removeCategory(evictingCategoryId)) {
          setPendingEvictingCategoryId(null);
          return;
        }
        const newCategoryId = createCategory({
          name: suggestion.name,
          color: suggestion.color,
          profileId: profileId ?? "",
        });
        if (!newCategoryId) return;
        setAdopted((current) => [
          ...current.filter((entry) => entry.categoryId !== evictingCategoryId),
          { suggestionId: suggestion.id, categoryId: newCategoryId },
        ]);
        setPendingEvictingCategoryId(null);
        setEnteringCategoryId(newCategoryId);
        if (enteringTimeoutRef.current != null) {
          window.clearTimeout(enteringTimeoutRef.current);
        }
        enteringTimeoutRef.current = window.setTimeout(() => {
          setEnteringCategoryId(null);
        }, SWAP_TRANSITION_MS + 220);
      };

      if (evictingCategoryId) {
        // Deixa o card em "saindo" por um instante antes de trocar os dados,
        // para a troca aparecer como uma animação em vez de um corte seco.
        setPendingEvictingCategoryId(evictingCategoryId);
        window.setTimeout(commitSwap, SWAP_TRANSITION_MS);
      } else {
        commitSwap();
      }
    },
    [
      suggestions,
      adopted,
      atCap,
      lastCategoryId,
      createCategory,
      removeCategory,
      profileId,
    ]
  );

  const dragOverSuggestion = dragOverSuggestionId
    ? suggestions.find((item) => item.id === dragOverSuggestionId)
    : undefined;

  const previewGhostSuggestion = dragOverSuggestion
    ? { name: dragOverSuggestion.name, color: dragOverSuggestion.color }
    : !atCap
      ? { name: "Arraste aqui", dashed: true }
      : null;
  const previewEvictingCategoryId =
    pendingEvictingCategoryId ??
    (dragOverSuggestion && atCap ? lastCategoryId : undefined);

  const childWithPreview = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{
          previewGhostSuggestion?: {
            name: string;
            color?: string;
            dashed?: boolean;
          } | null;
          previewEvictingCategoryId?: string;
          previewEnteringCategoryId?: string;
        }>,
        {
          previewGhostSuggestion,
          previewEvictingCategoryId,
          previewEnteringCategoryId: enteringCategoryId ?? undefined,
        }
      )
    : children;

  const clearDragPreview = () => {
    dragCounterRef.current = 0;
    setDragOverSuggestionId(null);
  };

  return (
    <div>
      <div
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes(DRAG_MIME_TYPE)) return;
          dragCounterRef.current += 1;
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes(DRAG_MIME_TYPE)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          if (!dragOverSuggestionId) setDragOverSuggestionId(draggingSuggestionIdRef.current);
        }}
        onDragLeave={() => {
          dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
          if (dragCounterRef.current === 0) setDragOverSuggestionId(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          const suggestionId = event.dataTransfer.getData(DRAG_MIME_TYPE);
          clearDragPreview();
          if (suggestionId) adoptSuggestion(suggestionId);
        }}
      >
        {childWithPreview}
      </div>

      <div className="mt-4 border-t border-border/55 pt-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/75">
          Sugestões
        </p>
        <p className="mt-1 text-xs leading-4 text-muted-foreground">
          Arraste para cima as que fizerem mais sentido pra você.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <SuggestionChip
              key={suggestion.id}
              suggestion={suggestion}
              adopted={adopted.some((entry) => entry.suggestionId === suggestion.id)}
              onDragStart={() => {
                draggingSuggestionIdRef.current = suggestion.id;
              }}
              onDragEnd={clearDragPreview}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
