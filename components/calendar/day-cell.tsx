"use client";

export function DayCell({
  date,
  dateIso,
  todayIso,
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
  todayIso: string;
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
        className={`w-full bg-neutral-200 dark:bg-neutral-900/80 ${isDropActive ? "ring-1 ring-inset ring-border bg-foreground/10" : ""}`}
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
  const today = dateIso === todayIso;
  const isPast = dateIso < todayIso;
  const dayToneClass = isPast
    ? isWeekend
      ? "bg-neutral-200 dark:bg-neutral-900/85"
      : "bg-neutral-100 dark:bg-neutral-900/70"
    : isWeekend
      ? "bg-neutral-100 dark:bg-neutral-900/55"
      : "bg-neutral-50 dark:bg-neutral-900/35";

  return (
    <div
      data-day-cell
      className={`flex w-full cursor-pointer flex-col px-1 py-0.5 ring-1 ring-inset transition-[box-shadow] duration-100 ${dayToneClass} ${
        today
          ? "ring-neutral-900 dark:ring-neutral-100"
          : "ring-transparent hover:ring-neutral-400/70 dark:hover:ring-neutral-600/70"
      } ${
        isRangeSelected
          ? "bg-neutral-300/35 ring-neutral-500/80 dark:bg-neutral-700/35 dark:ring-neutral-500/85"
          : ""
      } ${isRangeStart || isRangeEnd ? "ring-neutral-700 dark:ring-neutral-300" : ""} ${
        isDropActive ? "ring-border bg-foreground/10" : ""
      } select-none`}
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
      <div className="grid h-4 w-full flex-none place-items-center px-0.5 text-[10px] text-muted-foreground">
        <span
          className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-medium leading-none tabular-nums ${
            today
              ? "bg-neutral-900 text-white ring-1 ring-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:ring-neutral-100"
              : ""
          }`}
        >
          {date.getDate()}
        </span>
      </div>
      <div className="mt-0.5 flex-1" />
    </div>
  );
}
