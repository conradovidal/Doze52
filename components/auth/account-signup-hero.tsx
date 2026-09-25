import {
  CalendarDays,
  Cloud,
  Repeat,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import {
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_INDIGO,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_VIOLET,
  getCategoryColorToken,
} from "@/lib/category-palette";
import { PanelHero } from "@/components/ui/panel-list";

// Mesma técnica visual do Doze 52 Pro (ProFeatureStack): uma pilha de ícones
// nas cores das categorias deixa o valor legível antes de qualquer texto. Aqui
// o valor é o da conta grátis — guardar o que ela acabou de montar.
const ACCOUNT_BENEFITS: readonly {
  id: string;
  Icon: LucideIcon;
  color: string;
}[] = [
  { id: "events", Icon: CalendarDays, color: CATEGORY_COLOR_BASE_TEAL },
  { id: "habits", Icon: Repeat, color: CATEGORY_COLOR_BASE_VIOLET },
  { id: "cloud", Icon: Cloud, color: CATEGORY_COLOR_BASE_INDIGO },
  { id: "devices", Icon: Smartphone, color: CATEGORY_COLOR_BASE_CORAL },
];

export function AccountSignupHero({ className }: { className?: string }) {
  return (
    <PanelHero
      className={className}
      media={
        <div className="flex -space-x-2.5">
          {ACCOUNT_BENEFITS.map(({ id, Icon, color }, index) => {
            const token = getCategoryColorToken(color);
            return (
              <span
                key={id}
                aria-hidden="true"
                style={{
                  backgroundColor: token.soft,
                  borderColor: token.border,
                  color: token.text,
                  zIndex: ACCOUNT_BENEFITS.length - index,
                }}
                className="relative grid size-11 place-items-center rounded-full border ring-[3px] ring-card"
              >
                <Icon className="size-[18px]" />
              </span>
            );
          })}
        </div>
      }
      eyebrow={
        <>
          <Sparkles className="size-3" aria-hidden="true" />
          Conta grátis
        </>
      }
      title="Guarde o seu ano"
      description="Crie sua conta grátis e leve seus eventos e hábitos para qualquer aparelho, salvos na nuvem."
    />
  );
}
