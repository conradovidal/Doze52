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
