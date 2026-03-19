"use client";

import type { AnchorPoint, CalendarEvent } from "@/lib/types";
import * as React from "react";
import {
  EVENT_ITEM_HEIGHT_PX,
  EVENT_ITEM_LINE_HEIGHT_CLASS,
  EVENT_ITEM_PADDING_X_CLASS,
  EVENT_ITEM_TEXT_CLASS,
} from "@/lib/calendar-layout";
import { deriveEventBarStyle } from "@/lib/event-bar-style";

const MARKER_WIDTH_PX = 4;
const HORIZONTAL_PADDING_PX = 10;
const EXPANDED_EXTRA_GAP_PX = 12;

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
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const textRef = React.useRef<HTMLSpanElement | null>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [expandedWidthPx, setExpandedWidthPx] = React.useState<number | null>(null);
  const styles = React.useMemo(() => deriveEventBarStyle(event.color), [event.color]);
  const radius =
    isStart && isEnd
      ? "rounded-[8px]"
      : isStart
        ? "rounded-l-[8px]"
        : isEnd
        ? "rounded-r-[8px]"
          : "rounded-none";

  React.useLayoutEffect(() => {
    const button = buttonRef.current;
    const text = textRef.current;
    if (!button || !text) return;

    const updateMeasurements = () => {
      const textWidth = Math.ceil(text.scrollWidth);
      const buttonWidth = Math.ceil(button.clientWidth);
      const nextOverflowing = textWidth > text.clientWidth + 1;
      setIsOverflowing(nextOverflowing);
      setExpandedWidthPx(
        nextOverflowing
          ? Math.max(buttonWidth, textWidth + HORIZONTAL_PADDING_PX * 2 + MARKER_WIDTH_PX + EXPANDED_EXTRA_GAP_PX)
          : null
      );
    };

    updateMeasurements();
    const resizeObserver = new ResizeObserver(updateMeasurements);
    resizeObserver.observe(button);
    resizeObserver.observe(text);
    return () => resizeObserver.disconnect();
  }, [event.title]);

  return (
    <button
      ref={buttonRef}
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
      onMouseEnter={() => {
        if (isOverflowing) setIsExpanded(true);
      }}
      onMouseLeave={() => setIsExpanded(false)}
      onBlur={() => setIsExpanded(false)}
      className={`group relative block cursor-pointer border text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_16px_-14px_rgba(15,23,42,0.18)] transition-[transform,box-shadow,opacity,filter,width] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${EVENT_ITEM_PADDING_X_CLASS} ${EVENT_ITEM_TEXT_CLASS} ${radius} ${
        isPast ? "opacity-65 saturate-[0.92]" : ""
      } ${
        isDragging
          ? "opacity-40"
          : "hover:-translate-y-px hover:shadow-[0_14px_24px_-18px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.22)]"
      } ${isExpanded ? "z-30" : "w-full"} ${className ?? ""} overflow-hidden`}
      style={{
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
        color: styles.foregroundColor,
        paddingLeft: `${HORIZONTAL_PADDING_PX + MARKER_WIDTH_PX + 4}px`,
        paddingRight: `${HORIZONTAL_PADDING_PX}px`,
        width: isExpanded && expandedWidthPx ? `${expandedWidthPx}px` : undefined,
      }}
      title={event.title}
    >
      <span
        aria-hidden="true"
        className={`absolute bottom-[2px] left-[2px] top-[2px] ${
          isStart && isEnd
            ? "rounded-[6px]"
            : isStart
              ? "rounded-l-[6px]"
              : isEnd
                ? "rounded-r-[6px]"
                : "rounded-none"
        }`}
        style={{ backgroundColor: styles.markerColor, width: `${MARKER_WIDTH_PX}px` }}
      />
      <span
        ref={textRef}
        className={`block ${isExpanded ? "whitespace-nowrap" : "truncate"} ${EVENT_ITEM_LINE_HEIGHT_CLASS}`}
        style={{ minHeight: `${EVENT_ITEM_HEIGHT_PX}px` }}
      >
        {event.title}
      </span>
    </button>
  );
}
