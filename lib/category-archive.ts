import type { CategoryItem } from "./types";

export const isCategoryArchived = (category: Pick<CategoryItem, "archivedAt">) =>
  Boolean(category.archivedAt);

/** Categorias que aparecem em filtros, seletores e listas de gestão. */
export const isCategoryActive = (category: Pick<CategoryItem, "archivedAt">) =>
  !category.archivedAt;

/**
 * Se os eventos da categoria entram no calendário: ativas seguem o filtro
 * `visible`; arquivadas seguem a escolha "manter no calendário".
 */
export const isCategoryShownInCalendar = (
  category: Pick<CategoryItem, "archivedAt" | "archiveDisplay" | "visible">
) => (category.archivedAt ? category.archiveDisplay === "show" : category.visible);
