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
  value?: string | null;
  onChange: (color: string) => void;
  colors?: readonly string[];
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  // Só faz sentido para uma lista custom (`colors`) pequena o bastante pra
  // caber numa única linha — o conjunto padrão (24 cores) continua fixo em
  // 8 colunas/3 linhas independente disso.
  columns?: number;
  // Os círculos crescem para ocupar toda a largura disponível (formulários
  // que têm a paleta como elemento principal, como o editor de categoria).
  fill?: boolean;
};

export function CategoryColorPicker({
  value,
  onChange,
  colors,
  compact = false,
  disabled = false,
  className,
  ariaLabel = "Cor da categoria",
  columns,
  fill = false,
}: CategoryColorPickerProps) {
  const { mode } = useTheme();
  const normalizedValue = value
    ? getNearestCategoryColor(value).toLowerCase()
    : null;
  // Lista única (quem chama já passou as cores): sem legenda — "Cores"
  // acima de uma fileira de cores não informa nada. Os conjuntos nomeados
  // do seletor completo mantêm a sua.
  const colorSets: { id: string; label: string | null; colors: readonly string[] }[] =
    colors ? [{ id: "custom", label: null, colors }] : [...CATEGORY_COLOR_SETS];

  return (
    <div
      data-category-color-picker
      role="group"
      className={cn("w-full space-y-3.5", className)}
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      {colorSets.map((set, index) => (
        <fieldset
          key={set.id}
          disabled={disabled}
          className={cn(
            "space-y-2",
            index > 0 && "border-t border-border/50 pt-3"
          )}
        >
          {set.label && colorSets.length > 1 ? (
            <legend className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {set.label}
            </legend>
          ) : null}
          <div
            className={cn(!columns && "grid-cols-8", "grid gap-2 sm:gap-2.5")}
            style={
              columns
                ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                : undefined
            }
          >
            {set.colors.map((preset) => {
              const token = getCategoryColorToken(preset, mode);
              const selected = preset.toLowerCase() === normalizedValue;

              return (
                <button
                  key={preset}
                  type="button"
                  disabled={disabled}
                  data-category-color-swatch
                  data-color={preset}
                  onClick={() => onChange(preset)}
                  aria-label={`Selecionar ${token.label}`}
                  aria-pressed={selected}
                  title={token.label}
                  className={cn(
                    "grid place-items-center rounded-full border border-black/8 transition-[transform,opacity,box-shadow] hover:scale-105 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    disabled &&
                      "cursor-not-allowed opacity-45 hover:scale-100 hover:opacity-45",
                    fill
                      ? "aspect-square w-full"
                      : compact
                        ? "size-7"
                        : "size-[30px] sm:size-8"
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
                        compact ? "size-3.5" : "size-4"
                      )}
                      style={{ color: token.text }}
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
