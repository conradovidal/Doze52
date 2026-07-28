"use client";

import { Check } from "lucide-react";
import {
  CATEGORY_COLOR_SETS,
  getCategoryColorToken,
  getNearestCategoryColor,
} from "@/lib/category-palette";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type CategoryColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function CategoryColorPicker({
  value,
  onChange,
  compact = false,
  className,
  ariaLabel = "Cor da categoria",
}: CategoryColorPickerProps) {
  const { mode } = useTheme();
  const normalizedValue = getNearestCategoryColor(value).toLowerCase();

  return (
    <div
      data-category-color-picker
      role="group"
      className={cn("w-full space-y-3.5", className)}
      aria-label={ariaLabel}
    >
      {CATEGORY_COLOR_SETS.map((set, index) => (
        <fieldset
          key={set.id}
          className={cn(
            "space-y-2",
            index > 0 && "border-t border-border/50 pt-3"
          )}
        >
          <legend className="text-[11px] font-medium tracking-wide text-muted-foreground">
            {set.label}
          </legend>
          <div className="grid grid-cols-8 gap-2 sm:gap-2.5">
            {set.colors.map((preset) => {
              const token = getCategoryColorToken(preset, mode);
              const selected = preset.toLowerCase() === normalizedValue;

              return (
                <button
                  key={preset}
                  type="button"
                  data-category-color-swatch
                  data-color={preset}
                  onClick={() => onChange(preset)}
                  aria-label={`Selecionar ${token.label}`}
                  aria-pressed={selected}
                  title={token.label}
                  className={cn(
                    "grid place-items-center rounded-full border border-black/8 transition-[transform,opacity,box-shadow] hover:scale-105 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    compact ? "size-7" : "size-[30px] sm:size-8"
                  )}
                  style={{
                    backgroundColor: token.indicator,
                    boxShadow: selected
                      ? `0 0 0 2px var(--background), 0 0 0 4px ${token.indicator}`
                      : undefined,
                  }}
                >
                  {selected ? (
                    <Check
                      aria-hidden="true"
                      className={cn(
                        "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]",
                        compact ? "size-3.5" : "size-4"
                      )}
                      strokeWidth={3}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
