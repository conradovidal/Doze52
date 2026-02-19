"use client";

import { isBefore, isToday, startOfDay } from "date-fns";
import { fmtDayLabel } from "@/lib/date";

export function DayCell({
  date,
  dateIso,
  minHeightPx,
  isRangeSelected,
  isRangeStart,
  isRangeEnd,
  isInMonth,
  isDropActive = false,
  onDayHover,
  onDayDrop,
}: {
  date: Date;
  dateIso: string;
  minHeightPx: number;
  isRangeSelected: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInMonth: boolean;
  isDropActive?: boolean;
  onDayHover?: (dateIso: string) => void;
  onDayDrop?: (dateIso: string) => void;
}) {
  if (!isInMonth) {
    return (
      <div
        className={`w-full bg-neutral-200 ${isDropActive ? "ring-1 ring-inset ring-blue-500 bg-blue-100/30" : ""}`}
        style={{ minHeight: `${minHeightPx}px` }}
        onDragOver={(e) => {
          if (!onDayHover) return;
          e.preventDefault();
          e.stopPropagation();
          onDayHover(dateIso);
        }}
        onDrop={(e) => {
          if (!onDayDrop) return;
          e.preventDefault();
          e.stopPropagation();
          onDayDrop(dateIso);
        }}
      />
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
      } ${isDropActive ? "ring-blue-500 bg-blue-100/40" : ""} select-none`}
      style={{ minHeight: `${minHeightPx}px` }}
      onDragOver={(e) => {
        if (!onDayHover) return;
        e.preventDefault();
        e.stopPropagation();
        onDayHover(dateIso);
      }}
      onDrop={(e) => {
        if (!onDayDrop) return;
        e.preventDefault();
        e.stopPropagation();
        onDayDrop(dateIso);
      }}
    >
      <div className={`flex h-3.5 flex-none items-center gap-1 px-0.5 leading-none text-[10px] ${isPast ? "text-neutral-400" : "text-neutral-600"}`}>
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
