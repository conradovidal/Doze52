"use client";

import { isBefore, isToday, startOfDay } from "date-fns";
import { fmtDayLabel } from "@/lib/date";

export function DayCell({
  date,
  minHeightPx,
  isRangeSelected,
  isRangeStart,
  isRangeEnd,
  isInMonth,
}: {
  date: Date;
  minHeightPx: number;
  isRangeSelected: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInMonth: boolean;
}) {
  if (!isInMonth) {
    return (
      <div className="w-full bg-neutral-200" style={{ minHeight: `${minHeightPx}px` }} />
    );
  }

  const dayOfWeek = date.getDay(); // 0..6
  const baseBg =
    dayOfWeek === 0
      ? "bg-neutral-100"
      : dayOfWeek === 6
        ? "bg-neutral-100"
        : "bg-white";

  const today = isToday(date);
  const isPast = isBefore(startOfDay(date), startOfDay(new Date()));

  return (
    <div
      data-day-cell
      className={`flex w-full cursor-pointer flex-col px-1 py-0.5 ring-1 ring-inset transition-[box-shadow] duration-100 ${baseBg} ${
        today ? "ring-black" : "ring-transparent hover:ring-neutral-400/70"
      } ${isRangeSelected ? "bg-neutral-300/35 ring-neutral-500/80" : ""} ${
        isRangeStart || isRangeEnd ? "ring-neutral-700" : ""
      } select-none`}
      style={{ minHeight: `${minHeightPx}px` }}
    >
      <div className={`flex h-4 flex-none items-center gap-1 px-0.5 leading-none text-[10px] ${isPast ? "text-neutral-400" : "text-neutral-600"}`}>
        <span
          className={`relative inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium ${
            today ? "bg-black text-white ring-1 ring-black" : ""
          } aspect-square shrink-0`}
        >
          {date.getDate()}
        </span>
        <span data-weekday className="font-light text-neutral-500">
          {fmtDayLabel(date).split(" ")[1]}
        </span>
      </div>
      <div className="mt-0.5 flex-1" />
    </div>
  );
}
