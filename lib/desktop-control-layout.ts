// A faixa de controles acompanha a largura do calendário que ela comanda:
// as bordas dos dois batem e as categorias ganham o espaço que faltava.
export const DESKTOP_CONTROL_MAX_WIDTH_CLASS = "max-w-none";
export const DESKTOP_CONTROL_DIVIDER_CLASS =
  "border-t border-border/45 pt-3";
// Mesma borda, mas sempre presente (largura 1px fixa) com a cor em 0% de
// opacidade — usada no estado recolhido para que border-color anime de
// transparente até DESKTOP_CONTROL_DIVIDER_CLASS, em vez de alternar
// border-t presente/ausente. Sem isso, a cor de partida do fade cai para
// currentColor (opaco), e a borda pisca clara antes de assentar no tom
// discreto — some/aparece junto com a largura, não anima.
export const DESKTOP_CONTROL_DIVIDER_COLLAPSED_CLASS =
  "border-t border-border/0 pt-0";
export const DESKTOP_CONTROL_ROW_GAP_CLASS = "gap-2";
// Altura FIXA da faixa de controles quando expandida — usada em vez da
// altura automática (que mede o próprio conteúdo) nos dois lugares que
// precisam terminar exatamente na mesma posição: a faixa de categorias do
// Anual e a faixa de hábitos. Com altura automática, conteúdos diferentes
// (chips de categoria vs. controles de hábito) resultam em alturas
// diferentes mesmo "igualmente expandidos" — daí o topo do calendário bater
// em posições diferentes ao trocar de Anual para Hábitos. 3.75rem cobre
// confortavelmente o conteúdo mais alto das duas faixas (hábitos) com folga.
export const DESKTOP_CONTROL_FIXED_HEIGHT_CLASS = "h-[3.75rem]";
export const DESKTOP_CONTROL_NAV_GAP_CLASS = "md:space-y-2";
export const DESKTOP_CONTROL_GRID_GAP_CLASS = "mb-3";
export const DESKTOP_CONTROL_REGION_TOP_GAP_CLASS = "mt-2";
