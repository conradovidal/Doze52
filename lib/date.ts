import {
  addDays,
  endOfMonth,
  endOfYear,
  format,
  getDay,
  isWeekend,
  startOfMonth,
  startOfYear,
} from "date-fns";

const weekdayAbbr = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

export const fmtDayLabel = (date: Date) => {
  const day = format(date, "d");
  const abbr = weekdayAbbr[date.getDay()];
  return `${day} ${abbr}`;
};
const monthAbbr = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

export const fmtMonthLabel = (date: Date) => monthAbbr[date.getMonth()];
export const fmtIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

const getDatePartsInTimeZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Could not resolve date parts for timezone.");
  }

  return { year, month, day };
};

export const formatIsoDateInTimeZone = (date: Date, timeZone: string) => {
  try {
    const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
    return `${year}-${month}-${day}`;
  } catch {
    return fmtIsoDate(date);
  }
};

export const getTodayIsoInTimeZone = (timeZone: string) =>
  formatIsoDateInTimeZone(new Date(), timeZone);

export const getYearDays = (year: number) => {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(start);
  const days: Date[] = [];
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
};

export const getMonthDaysWithLeading = (year: number, monthIndex: number) => {
  const start = startOfMonth(new Date(year, monthIndex, 1));
  const end = endOfMonth(start);
  const days: Date[] = [];
  const leading = getDay(start); // 0..6, Sun..Sat
  for (let i = 0; i < leading; i += 1) days.push(new Date(0));
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
};

export const isPlaceholder = (date: Date) => date.getTime() === 0;
export const isWeekendDay = (date: Date) => isWeekend(date);
