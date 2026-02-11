"use client";

import { isBefore, parseISO, startOfDay } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import * as React from "react";

export function EventBar({
  event,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
  isStart = true,
  isEnd = true,
  className,
}: {
  event: CalendarEvent;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  className?: string;
}) {
  const today = startOfDay(new Date());
  const isPast = isBefore(parseISO(event.endDate), today);
  const radius =
    isStart && isEnd
      ? "rounded-sm"
      : isStart
        ? "rounded-l-sm"
        : isEnd
          ? "rounded-r-sm"
          : "rounded-none";

  return (
    <button
      type="button"
      draggable={draggable}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", event.id);
        onDragStart?.(e);
      }}
      onDragEnd={() => onDragEnd?.()}
      className={`group relative block h-[14px] w-full cursor-pointer truncate px-1.5 text-left text-[9px] font-light text-neutral-100 ${radius} ${isPast ? "opacity-50" : ""} ${isDragging ? "opacity-40" : ""} ${className ?? ""} overflow-visible`}
      style={{ backgroundColor: event.color }}
      title={event.title}
    >
      <span className="block truncate leading-[14px]">{event.title}</span>
      <span
        className={`pointer-events-none absolute left-0 top-0 z-20 hidden h-[14px] whitespace-nowrap px-1.5 text-[9px] text-white ${isDragging ? "" : "group-hover:inline-flex group-hover:items-center"} ${radius}`}
        style={{ backgroundColor: event.color }}
      >
        {event.title}
      </span>
    </button>
  );
}
