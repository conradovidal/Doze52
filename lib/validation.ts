import { parseISO } from "date-fns";
import type { CalendarEvent, CalendarProfile, CategoryItem } from "@/lib/types";
import { isProfileIconId } from "@/lib/profile-icons";

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

const isRecurrenceType = (
  value: CalendarEvent["recurrenceType"]
): value is NonNullable<CalendarEvent["recurrenceType"]> =>
  value === "weekly" || value === "monthly" || value === "yearly";

export const validateCategoryInput = (category: CategoryItem) => {
  if (!category.id?.trim()) {
    throw new ValidationError("Categoria invalida: id ausente.");
  }
  if (!category.profileId?.trim()) {
    throw new ValidationError("Categoria invalida: perfil obrigatorio.");
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

export const validateProfileInput = (profile: CalendarProfile) => {
  if (!profile.id?.trim()) {
    throw new ValidationError("Perfil invalido: id ausente.");
  }
  if (!profile.name?.trim()) {
    throw new ValidationError("Perfil invalido: nome obrigatorio.");
  }
  if (!HEX_COLOR_RE.test(profile.color)) {
    throw new ValidationError("Perfil invalido: cor fora do padrao.");
  }
  if (!isProfileIconId(profile.icon)) {
    throw new ValidationError("Perfil invalido: icone fora do padrao.");
  }
  if (!Number.isFinite(profile.position) || !Number.isInteger(profile.position)) {
    throw new ValidationError("Perfil invalido: posicao deve ser inteira.");
  }
  if (profile.position < 0) {
    throw new ValidationError("Perfil invalido: posicao nao pode ser negativa.");
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
  if (event.recurrenceType !== undefined && !isRecurrenceType(event.recurrenceType)) {
    throw new ValidationError("Evento invalido: tipo de recorrencia invalido.");
  }
  if (event.recurrenceUntil !== undefined) {
    if (!event.recurrenceType) {
      throw new ValidationError(
        "Evento invalido: data limite de recorrencia exige tipo de recorrencia."
      );
    }
    if (!isIsoDate(event.recurrenceUntil)) {
      throw new ValidationError("Evento invalido: data limite de recorrencia invalida.");
    }
    if (event.recurrenceUntil < event.startDate) {
      throw new ValidationError(
        "Evento invalido: data limite de recorrencia nao pode ser anterior ao inicio."
      );
    }
  }
};
