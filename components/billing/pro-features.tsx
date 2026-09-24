import {
  CalendarDays,
  FileSpreadsheet,
  Layers,
  Repeat,
  Tags,
  type LucideIcon,
} from "lucide-react";

import {
  CATEGORY_COLOR_BASE_AMBER,
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_INDIGO,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_VIOLET,
  getCategoryColorToken,
} from "@/lib/category-palette";
import { PLAN_LIMITS, type ProUpgradeReason } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

export type ProFeature = {
  id: string;
  label: string;
  /** Nome curto usado na comparação Free × Pro. */
  shortLabel: string;
  free: string;
  pro: string;
  Icon: LucideIcon;
  color: string;
  /** Motivo que destaca este benefício (o que a pessoa acabou de tentar). */
  reason: ProUpgradeReason;
};

// Mesma técnica visual da capa do onboarding: uma pilha de ícones nas cores
// das categorias deixa o valor legível antes de qualquer texto.
export const PRO_FEATURES: readonly ProFeature[] = [
  { id: "profiles", label: "Contextos ilimitados", shortLabel: "Contextos", free: `${PLAN_LIMITS.free.maxProfiles}`, pro: "Ilimitados", Icon: Layers, color: CATEGORY_COLOR_BASE_INDIGO, reason: "profiles" },
  { id: "categories", label: "Categorias ilimitadas", shortLabel: "Categorias", free: `${PLAN_LIMITS.free.maxCategories}`, pro: "Ilimitadas", Icon: Tags, color: CATEGORY_COLOR_BASE_CORAL, reason: "categories" },
  { id: "calendars", label: "Calendários prontos ilimitados", shortLabel: "Calendários prontos", free: `${PLAN_LIMITS.free.maxCalendarSubscriptions}`, pro: "Ilimitados", Icon: CalendarDays, color: CATEGORY_COLOR_BASE_TEAL, reason: "calendar-subscriptions" },
  { id: "habits", label: `Até ${PLAN_LIMITS.pro.maxHabits} hábitos`, shortLabel: "Hábitos", free: `${PLAN_LIMITS.free.maxHabits}`, pro: `${PLAN_LIMITS.pro.maxHabits}`, Icon: Repeat, color: CATEGORY_COLOR_BASE_VIOLET, reason: "habits" },
  { id: "spreadsheet", label: "Importar e exportar planilhas", shortLabel: "Importar e exportar planilhas", free: "—", pro: "Incluído", Icon: FileSpreadsheet, color: CATEGORY_COLOR_BASE_AMBER, reason: "calendar-import-export" },
];

/** Ícone de um benefício do Pro no círculo com a cor da categoria. */
export function ProFeatureIcon({
  feature,
  className,
  iconClassName,
}: {
  feature: ProFeature;
  className?: string;
  iconClassName?: string;
}) {
  const token = getCategoryColorToken(feature.color);
  const { Icon } = feature;
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-6 shrink-0 place-items-center rounded-full", className)}
      style={{ backgroundColor: token.soft, color: token.text }}
    >
      <Icon className={cn("size-3.5", iconClassName)} />
    </span>
  );
}

/** Pilha de ícones sobrepostos — a "capa" do Pro. */
export function ProFeatureStack({
  reason,
  size = "md",
  className,
}: {
  reason?: ProUpgradeReason;
  size?: "sm" | "md";
  className?: string;
}) {
  const small = size === "sm";
  return (
    <div className={cn("flex", small ? "-space-x-1.5" : "-space-x-2.5", className)}>
      {PRO_FEATURES.map(({ id, Icon, color, reason: featureReason }, index) => {
        const token = getCategoryColorToken(color);
        const featured = featureReason === reason;
        return (
          <span
            key={id}
            aria-hidden="true"
            style={{
              backgroundColor: token.soft,
              borderColor: token.border,
              color: token.text,
              zIndex: featured ? PRO_FEATURES.length + 1 : PRO_FEATURES.length - index,
            }}
            className={cn(
              "relative grid place-items-center rounded-full border ring-card transition-transform",
              small ? "size-7 ring-2" : "size-11 ring-[3px]",
              featured && "-translate-y-1 scale-110"
            )}
          >
            <Icon className={small ? "size-3.5" : "size-[18px]"} />
          </span>
        );
      })}
    </div>
  );
}
