export const CALENDAR_EVENT_DND_MIME = "application/x-doze52-event-dnd";

export type CalendarEventDndPayload = {
  eventId: string;
  startDate: string;
  endDate: string;
  isMultiDay: boolean;
  grabOffsetDays: number;
};

const transferTypesToArray = (
  transfer: DataTransfer | null | undefined
): string[] => {
  if (!transfer?.types) return [];
  return Array.from(transfer.types);
};

const isValidPayload = (value: unknown): value is CalendarEventDndPayload => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<CalendarEventDndPayload>;
  return (
    typeof candidate.eventId === "string" &&
    candidate.eventId.length > 0 &&
    typeof candidate.startDate === "string" &&
    candidate.startDate.length > 0 &&
    typeof candidate.endDate === "string" &&
    candidate.endDate.length > 0 &&
    typeof candidate.isMultiDay === "boolean" &&
    typeof candidate.grabOffsetDays === "number" &&
    Number.isFinite(candidate.grabOffsetDays)
  );
};

export const writeCalendarEventDndPayload = (
  transfer: DataTransfer | null | undefined,
  payload: CalendarEventDndPayload
) => {
  if (!transfer) return;
  transfer.setData(CALENDAR_EVENT_DND_MIME, JSON.stringify(payload));
  transfer.setData("text/plain", payload.eventId);
};

export const readCalendarEventDndPayload = (
  transfer: DataTransfer | null | undefined
): CalendarEventDndPayload | null => {
  if (!transfer) return null;
  const raw = transfer.getData(CALENDAR_EVENT_DND_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidPayload(parsed)) return null;
    return {
      ...parsed,
      grabOffsetDays: Math.max(0, Math.trunc(parsed.grabOffsetDays)),
    };
  } catch {
    return null;
  }
};

export const hasCalendarEventDndPayloadType = (
  transfer: DataTransfer | null | undefined
) => transferTypesToArray(transfer).includes(CALENDAR_EVENT_DND_MIME);
