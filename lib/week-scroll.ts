/**
 * Onde o "hoje" aparece nas grades mobile "semana = linha" (Eventos e
 * Hábitos): a semana atual fica na 5ª linha, com as 4 semanas anteriores
 * acima. Em telas baixas, onde cabem poucas linhas, sobem só 2 semanas
 * para sobrar futuro visível.
 *
 * Conta em linhas, não em pixels: cada grade marca suas linhas com
 * `data-week-row` e a semana atual com `data-week-current`, e a altura de
 * cada linha (fixa nos Hábitos, variável nos Eventos) é lida do DOM.
 */
export const TODAY_WEEKS_BEFORE = 4;
export const TODAY_WEEKS_BEFORE_COMPACT = 2;
/** Abaixo disto (linhas visíveis), usa o recuo compacto. */
const COMPACT_VISIBLE_ROWS = 10;

export const getTodayWeekScrollTop = (region: HTMLElement): number | null => {
  const rows = Array.from(region.querySelectorAll<HTMLElement>("[data-week-row]"));
  const currentIndex = rows.findIndex((row) => row.hasAttribute("data-week-current"));
  if (currentIndex < 0) return null;

  const style = window.getComputedStyle(region);
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
  const rowHeight = rows[currentIndex].offsetHeight || 1;
  const visibleRows = (region.clientHeight - paddingTop - paddingBottom) / rowHeight;
  const weeksBefore =
    visibleRows < COMPACT_VISIBLE_ROWS ? TODAY_WEEKS_BEFORE_COMPACT : TODAY_WEEKS_BEFORE;

  // No começo do ano não há semanas suficientes acima: a primeira linha
  // vira a âncora e o hoje só sobe, sem espaço vazio no topo.
  const anchor = rows[Math.max(0, currentIndex - weeksBefore)];
  const top =
    region.scrollTop +
    (anchor.getBoundingClientRect().top - region.getBoundingClientRect().top) -
    paddingTop;
  return Math.max(0, Math.round(top));
};
