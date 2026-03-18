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
  const isPast = dateIso < todayIso;

  if (!isInMonth) {
    return (
      <div
        data-day-iso={dateIso}
        className={`w-full transition-colors ${
          isPast
            ? "bg-neutral-100/55 dark:bg-[hsl(var(--cal-cell-outside-past))]"
            : "bg-neutral-50/45 dark:bg-[hsl(var(--cal-cell-outside))]"
        } ${isDropActive ? "ring-1 ring-inset ring-border/70 bg-foreground/6" : ""}`}
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
  const dayToneClass = isPast
    ? isWeekend
      ? "bg-neutral-200/55 dark:bg-[hsl(var(--cal-cell-weekend-past))]"
      : "bg-neutral-100/72 dark:bg-[hsl(var(--cal-cell-weekday-past))]"
    : isWeekend
      ? "bg-neutral-100/78 dark:bg-[hsl(var(--cal-cell-weekend))]"
      : "bg-white dark:bg-[hsl(var(--cal-cell-weekday))]";
  const dayNumberToneClass = isWeekend
    ? "text-neutral-500 dark:text-neutral-300"
    : "text-muted-foreground dark:text-neutral-200";

  return (
    <div
      data-day-cell
      data-day-iso={dateIso}
      className={`group flex w-full cursor-pointer flex-col px-1 py-1 ring-1 ring-inset transition-[background-color,box-shadow] duration-150 ${dayToneClass} ${
        today
          ? "ring-neutral-900 shadow-[inset_0_0_0_1px_rgba(23,23,23,0.06)] dark:ring-neutral-100 dark:shadow-none"
          : "ring-transparent hover:ring-neutral-300/80 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.46),0_10px_18px_-18px_rgba(15,23,42,0.26)] dark:hover:bg-white/6 dark:hover:ring-neutral-500/60"
      } ${
        isRangeSelected
          ? "bg-neutral-300/35 ring-neutral-400/80 dark:bg-neutral-700/45 dark:ring-neutral-500/85"
          : ""
      } ${
        isRangeStart || isRangeEnd
          ? "ring-neutral-700 shadow-[inset_0_0_0_1px_rgba(38,38,38,0.12)] dark:ring-neutral-300 dark:shadow-none"
          : ""
      } ${
        isDropActive ? "bg-foreground/8 ring-border" : ""
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
      <div className={`grid h-6 w-full flex-none place-items-center px-0.5 text-[12px] ${dayNumberToneClass}`}>
        <span
          className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[12px] font-semibold leading-none tabular-nums transition-colors ${
            today
              ? "bg-neutral-900 text-white ring-1 ring-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:ring-neutral-100"
              : "group-hover:text-foreground dark:group-hover:text-neutral-100"
          }`}
        >
          {date.getDate()}
        </span>
      </div>
      <div className="mt-1 flex-1" />
    </div>
  );
}
