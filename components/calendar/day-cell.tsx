"use client";

import { isBefore, isToday, startOfDay } from "date-fns";

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
  onDayDrop?: (dateIso: string, transfer?: DataTransfer | null) => void;
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
          onDayDrop(dateIso, e.dataTransfer);
        }}
      />
    );
  }

  const dayOfWeek = date.getDay(); // 0..6
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const today = isToday(date);
  const isPast = isBefore(startOfDay(date), startOfDay(new Date()));
  const dayToneClass = isPast
    ? isWeekend
      ? "bg-[#ededed]"
      : "bg-[#f1f1f1]"
    : isWeekend
      ? "bg-neutral-100"
      : "bg-neutral-50";

  return (
    <div
      data-day-cell
      className={`flex w-full cursor-pointer flex-col px-1 py-0.5 ring-1 ring-inset transition-[box-shadow] duration-100 ${dayToneClass} ${
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
        onDayDrop(dateIso, e.dataTransfer);
      }}
    >
      <div className="flex h-4 w-full flex-none items-start justify-center px-0.5 leading-none text-[10px] text-neutral-600">
        <span
          className={`relative inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium ${
            today ? "bg-black text-white ring-1 ring-black" : ""
          } aspect-square shrink-0`}
        >
          {date.getDate()}
        </span>
      </div>
      <div className="mt-0.5 flex-1" />
    </div>
  );
}
