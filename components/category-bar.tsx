"use client";

import { Eye, EyeOff } from "lucide-react";
import { useStore } from "@/lib/store";

const MOTION_CLASS = "duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

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

type CategoryBarProps = {
  compact?: boolean;
  isGlobalEditMode?: boolean;
};

export function CategoryBar({ compact = false }: CategoryBarProps) {
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const categories = useStore((s) => s.categories);
  const toggleCategoryVisibility = useStore((s) => s.toggleCategoryVisibility);
  const setCategoriesVisibility = useStore((s) => s.setCategoriesVisibility);

  const activeProfileIds = new Set(selectedProfileIds);
  const displayedCategories = categories.filter((category) =>
    activeProfileIds.has(category.profileId)
  );
  const displayedCategoryIds = displayedCategories.map((category) => category.id);
  const allDisplayedVisible = displayedCategories.every((category) => category.visible);
  const visibilityActionLabel = allDisplayedVisible
    ? "Limpar categorias visiveis"
    : "Mostrar todas as categorias visiveis";

  if (displayedCategories.length === 0) {
    return null;
  }

  return (
    <div
      className={`${compact ? "w-full min-h-8 justify-center" : "mb-2 min-h-8 justify-center"} flex flex-wrap items-center gap-1.5 sm:gap-2`}
    >
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
