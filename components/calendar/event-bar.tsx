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
      ? "rounded-[8px]"
      : isStart
        ? "rounded-l-[8px]"
        : isEnd
          ? "rounded-r-[8px]"
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
      aria-label={event.title}
      className={`group relative block w-full cursor-pointer truncate border border-black/10 text-left text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_16px_-14px_rgba(15,23,42,0.32)] transition-[transform,box-shadow,opacity,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${EVENT_ITEM_PADDING_X_CLASS} ${EVENT_ITEM_TEXT_CLASS} ${radius} ${
        isPast ? "opacity-65 saturate-[0.92]" : ""
      } ${
        isDragging
          ? "opacity-40"
          : "hover:-translate-y-px hover:brightness-[1.02] hover:shadow-[0_14px_24px_-18px_rgba(15,23,42,0.5),inset_0_1px_0_rgba(255,255,255,0.24)]"
      } ${className ?? ""} overflow-hidden`}
      style={{ backgroundColor: event.color }}
      title={event.title}
    >
      <span
        className={`block truncate ${EVENT_ITEM_LINE_HEIGHT_CLASS}`}
        style={{ minHeight: `${EVENT_ITEM_HEIGHT_PX}px` }}
      >
        {event.title}
      </span>
    </button>
  );
}
