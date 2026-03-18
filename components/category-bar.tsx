"use client";

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

  const activeProfileIds = new Set(selectedProfileIds);
  const displayedCategories = categories.filter((category) =>
    activeProfileIds.has(category.profileId)
  );

  if (displayedCategories.length === 0) {
    return null;
  }

  return (
    <div
      className={`${compact ? "w-full min-h-9 justify-center" : "mb-2 min-h-9 justify-center"} flex flex-wrap items-center gap-2`}
    >
      {displayedCategories.map((category) => (
        <button
          key={category.id}
          type="button"
          aria-pressed={category.visible}
          onClick={() => toggleCategoryVisibility(category.id)}
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${MOTION_CLASS} ${
            category.visible
              ? "text-foreground"
              : "bg-background text-muted-foreground hover:text-foreground"
          }`}
          style={{
            backgroundColor: category.visible
              ? hexToRgba(category.color, 0.12)
              : "hsl(var(--background))",
            borderColor: category.visible
              ? hexToRgba(category.color, 0.24)
              : "hsl(var(--border))",
          }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: category.color,
              opacity: category.visible ? 1 : 0.55,
            }}
          />
          <span className={category.visible ? "text-foreground" : "text-muted-foreground"}>
            {category.name}
          </span>
        </button>
      ))}
    </div>
  );
}
