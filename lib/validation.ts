import { parseISO } from "date-fns";
import type { CalendarEvent, CategoryItem } from "@/lib/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const isIsoDate = (value: string) => {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = parseISO(value);
  return !Number.isNaN(parsed.getTime());
};

export const validateCategoryInput = (category: CategoryItem) => {
  if (!category.id?.trim()) {
    throw new ValidationError("Categoria invalida: id ausente.");
  }
  if (!category.name?.trim()) {
    throw new ValidationError("Categoria invalida: nome obrigatorio.");
  }
  if (!HEX_COLOR_RE.test(category.color)) {
    throw new ValidationError("Categoria invalida: cor fora do padrao.");
  }
  if (typeof category.visible !== "boolean") {
    throw new ValidationError("Categoria invalida: visibilidade obrigatoria.");
  }
};

export const validateEventInput = (event: CalendarEvent, categoryIds: Set<string>) => {
  if (!event.id?.trim()) {
    throw new ValidationError("Evento invalido: id ausente.");
  }
  if (!event.title?.trim()) {
    throw new ValidationError("Evento invalido: titulo obrigatorio.");
  }
  if (!event.categoryId?.trim() || !categoryIds.has(event.categoryId)) {
    throw new ValidationError("Evento invalido: categoria nao encontrada.");
  }
  if (!isIsoDate(event.startDate) || !isIsoDate(event.endDate)) {
    throw new ValidationError("Evento invalido: data fora do formato ISO.");
  }
  if (event.endDate < event.startDate) {
    throw new ValidationError("Evento invalido: fim nao pode ser antes do inicio.");
  }
  if (!Number.isFinite(event.dayOrder) || !Number.isInteger(event.dayOrder)) {
    throw new ValidationError("Evento invalido: ordem deve ser inteira.");
  }
  if (event.dayOrder < 0) {
    throw new ValidationError("Evento invalido: ordem nao pode ser negativa.");
  }
  if (event.notes !== undefined && typeof event.notes !== "string") {
    throw new ValidationError("Evento invalido: descricao invalida.");
  }
  if (typeof event.notes === "string" && event.notes.length > 2000) {
    throw new ValidationError("Evento invalido: descricao muito longa.");
  }
};
