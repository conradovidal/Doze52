import { cn } from "@/lib/utils";

// Aba de destino (Eventos/Hábitos) no desktop: ícone + nome, ativo com o
// mesmo fundo discreto do hover dos ícones. Usada na navegação do topo e nas
// abas do Organizar, para as duas não divergirem.
export const getDestinationTabClass = (active: boolean) =>
  cn(
    "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
    active
      ? "bg-muted/70 text-foreground"
      : "text-muted-foreground/70 hover:bg-muted/45 hover:text-foreground/85"
  );
