"use client";

import type { AnchorPoint, CalendarEvent } from "@/lib/types";
import * as React from "react";
import {
  EVENT_ITEM_HEIGHT_PX,
  EVENT_ITEM_LINE_HEIGHT_CLASS,
  EVENT_ITEM_PADDING_X_CLASS,
  EVENT_ITEM_TEXT_CLASS,
} from "@/lib/calendar-layout";

export function EventBar({
  event,
  todayIso,
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
  todayIso: string;
  onClick?: (payload: { anchorPoint: AnchorPoint }) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  className?: string;
}) {
  const isPast = event.endDate < todayIso;
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
        const rect = e.currentTarget.getBoundingClientRect();
        onClick?.({
          anchorPoint: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
        });
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
      className={`group relative block w-full cursor-pointer truncate border border-black/8 text-left text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition-[transform,box-shadow,opacity] duration-150 ${EVENT_ITEM_PADDING_X_CLASS} ${EVENT_ITEM_TEXT_CLASS} ${radius} ${isPast ? "opacity-55" : ""} ${isDragging ? "opacity-40" : "hover:-translate-y-px hover:shadow-[0_6px_14px_-10px_rgba(15,23,42,0.42),inset_0_1px_0_rgba(255,255,255,0.18)]"} ${className ?? ""} overflow-visible`}
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
        className={`pointer-events-none absolute left-0 top-0 z-20 hidden whitespace-nowrap border border-black/8 text-white shadow-[0_10px_20px_-16px_rgba(15,23,42,0.48)] ${EVENT_ITEM_PADDING_X_CLASS} ${EVENT_ITEM_TEXT_CLASS} ${isDragging ? "" : "group-hover:inline-flex group-hover:items-center"} ${radius}`}
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
