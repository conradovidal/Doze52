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
        className={`w-full bg-neutral-200 ${
          isPast
            ? "dark:bg-[hsl(var(--cal-cell-outside-past))]"
            : "dark:bg-[hsl(var(--cal-cell-outside))]"
        } ${isDropActive ? "ring-1 ring-inset ring-border bg-foreground/10" : ""}`}
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
      ? "bg-neutral-200/85 dark:bg-[hsl(var(--cal-cell-weekend-past))]"
      : "bg-neutral-100/90 dark:bg-[hsl(var(--cal-cell-weekday-past))]"
    : isWeekend
      ? "bg-neutral-100 dark:bg-[hsl(var(--cal-cell-weekend))]"
      : "bg-neutral-50/95 dark:bg-[hsl(var(--cal-cell-weekday))]";
  const dayNumberToneClass = isWeekend
    ? "text-muted-foreground dark:text-neutral-300"
    : "text-muted-foreground dark:text-neutral-200";

  return (
    <div
      data-day-cell
      data-day-iso={dateIso}
      className={`group flex w-full cursor-pointer flex-col px-1 py-1 ring-1 ring-inset transition-[background-color,box-shadow] duration-150 ${dayToneClass} ${
        today
          ? "ring-neutral-900 shadow-[inset_0_0_0_1px_rgba(23,23,23,0.08)] dark:ring-neutral-100 dark:shadow-none"
          : "ring-transparent hover:bg-white hover:ring-neutral-400/75 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] dark:hover:bg-white/4 dark:hover:ring-neutral-500/70"
      } ${
        isRangeSelected
          ? "bg-neutral-300/45 ring-neutral-500/80 dark:bg-neutral-700/45 dark:ring-neutral-500/85"
          : ""
      } ${isRangeStart || isRangeEnd ? "ring-neutral-700 shadow-[inset_0_0_0_1px_rgba(38,38,38,0.12)] dark:ring-neutral-300 dark:shadow-none" : ""} ${
        isDropActive ? "bg-foreground/10 ring-border" : ""
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
      <div className={`grid h-5 w-full flex-none place-items-center px-0.5 text-[11px] ${dayNumberToneClass}`}>
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
      <div className="mt-0.5 flex-1" />
    </div>
  );
}
