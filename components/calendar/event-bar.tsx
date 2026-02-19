"use client";

import { isBefore, parseISO, startOfDay } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import * as React from "react";
import {
  EVENT_ITEM_HEIGHT_PX,
  EVENT_ITEM_LINE_HEIGHT_CLASS,
  EVENT_ITEM_PADDING_X_CLASS,
  EVENT_ITEM_TEXT_CLASS,
} from "@/lib/calendar-layout";

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
  const isDragCycleRef = React.useRef(false);
  const lastDragEndAtRef = React.useRef(0);
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
        const justDragged = performance.now() - lastDragEndAtRef.current < 180;
        if (isDragCycleRef.current || justDragged) {
          e.preventDefault();
          e.stopPropagation();
          isDragCycleRef.current = false;
          return;
        }
        e.stopPropagation();
        onClick?.();
      }}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", event.id);
        isDragCycleRef.current = true;
        onDragStart?.(e);
      }}
      onDragEnd={() => {
        isDragCycleRef.current = false;
        lastDragEndAtRef.current = performance.now();
        window.setTimeout(() => {
          onDragEnd?.();
        }, 0);
      }}
      className={`group relative block w-full cursor-pointer truncate text-left text-neutral-100 ${EVENT_ITEM_PADDING_X_CLASS} ${EVENT_ITEM_TEXT_CLASS} ${radius} ${isPast ? "opacity-50" : ""} ${isDragging ? "opacity-40" : ""} ${className ?? ""} overflow-visible`}
      style={{ backgroundColor: event.color }}
      title={event.title}
    >
      <span
        className={`block truncate ${EVENT_ITEM_LINE_HEIGHT_CLASS}`}
        style={{ minHeight: `${EVENT_ITEM_HEIGHT_PX}px` }}
      >
        {event.title}
      </span>
      <span
        className={`pointer-events-none absolute left-0 top-0 z-20 hidden whitespace-nowrap text-white ${EVENT_ITEM_PADDING_X_CLASS} ${EVENT_ITEM_TEXT_CLASS} ${isDragging ? "" : "group-hover:inline-flex group-hover:items-center"} ${radius}`}
        style={{
          minHeight: `${EVENT_ITEM_HEIGHT_PX}px`,
          lineHeight: `${EVENT_ITEM_HEIGHT_PX}px`,
          backgroundColor: event.color,
        }}
      >
        {event.title}
      </span>
    </button>
  );
}
