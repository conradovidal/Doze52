export type YearTransitionDirection = 1 | -1;

export const getYearTransitionDirection = (
  currentYear: number,
  nextYear: number
): YearTransitionDirection => (nextYear >= currentYear ? 1 : -1);
