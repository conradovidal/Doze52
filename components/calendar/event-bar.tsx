"use client";

import type { AnchorPoint, CalendarEvent } from "@/lib/types";
import * as React from "react";
import { createPortal } from "react-dom";
import { ProfileIcon } from "@/components/profile-icon";
import {
  EVENT_ITEM_HEIGHT_PX,
  EVENT_ITEM_LINE_HEIGHT_CLASS,
  EVENT_ITEM_PADDING_X_CLASS,
  EVENT_ITEM_TEXT_CLASS,
} from "@/lib/calendar-layout";
import { getCategoryColorToken } from "@/lib/category-palette";
import type { ProfileIconId } from "@/lib/profile-icons";
import { useTheme } from "@/lib/theme";

const HOVER_PREVIEW_VERTICAL_GAP_PX = 8;
const HOVER_PREVIEW_VIEWPORT_PADDING_PX = 12;
const HOVER_PREVIEW_MAX_WIDTH_PX = 420;
const HOVER_PREVIEW_MIN_WIDTH_PX = 180;
const COMPACT_SYMBOL_FONT_FAMILY =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const getHoverPreviewMaxWidth = () =>
  Math.min(
    HOVER_PREVIEW_MAX_WIDTH_PX,
    Math.max(
      HOVER_PREVIEW_MIN_WIDTH_PX,
      window.innerWidth - HOVER_PREVIEW_VIEWPORT_PADDING_PX * 2
    )
  );

const getFirstWord = (title: string) => title.trim().split(/\s+/)[0] ?? "";

const isCompactSymbolMatchupTitle = (title: string) => {
  const tokens = title.trim().split(/\s+/).filter(Boolean);
  return tokens.length === 2 && !/[0-9A-Za-zÀ-ÿ]/.test(title);
};

const getTextFont = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  return (
    style.font ||
    `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  );
};

const measureTextWidth = (element: HTMLElement, value: string) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return Number.POSITIVE_INFINITY;
  context.font = getTextFont(element);
  return context.measureText(value).width;
};

export function EventBar({
  event,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
  isStart = true,
  isEnd = true,
  profileIcon,
  className,
}: {
  event: CalendarEvent;
  onClick?: (payload: { anchorPoint: AnchorPoint }) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  profileIcon?: ProfileIconId;
  className?: string;
}) {
  const { mode: themeMode } = useTheme();
  const colorToken = React.useMemo(
    () => getCategoryColorToken(event.color, themeMode),
    [event.color, themeMode]
  );
  const isDragCycleRef = React.useRef(false);
  const lastDragEndAtRef = React.useRef(0);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const textRef = React.useRef<HTMLSpanElement | null>(null);
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const hoverPreviewId = React.useId();
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const [doesFirstWordFit, setDoesFirstWordFit] = React.useState(false);
  const [isHoverPreviewVisible, setIsHoverPreviewVisible] = React.useState(false);
  const [hoverPreviewStyle, setHoverPreviewStyle] = React.useState<React.CSSProperties | null>(
    null
  );
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
      const nextOverflowing = text.scrollWidth > text.clientWidth + 1;
      const firstWord = getFirstWord(event.title);
      const firstWordPreviewWidth = firstWord
        ? measureTextWidth(text, `${firstWord}...`)
        : Number.POSITIVE_INFINITY;
      setIsOverflowing(nextOverflowing);
      setDoesFirstWordFit(firstWordPreviewWidth <= text.clientWidth + 1);
    };

    updateMeasurements();
    const resizeObserver = new ResizeObserver(updateMeasurements);
    resizeObserver.observe(button);
    resizeObserver.observe(text);
    return () => resizeObserver.disconnect();
  }, [event.title]);

  React.useLayoutEffect(() => {
    if (!isHoverPreviewVisible) {
      setHoverPreviewStyle(null);
      return;
    }

    const button = buttonRef.current;
    if (!button) return;

    const updatePreviewPosition = () => {
      const rect = button.getBoundingClientRect();
      const preview = previewRef.current;
      if (!preview) return;

      const maxWidth = getHoverPreviewMaxWidth();
      preview.style.maxWidth = `${maxWidth}px`;
      const previewRect = preview.getBoundingClientRect();
      const previewWidth = Math.min(previewRect.width, maxWidth);
      const previewHeight = previewRect.height;

      let left = rect.left + rect.width / 2 - previewWidth / 2;
      left = Math.max(
        HOVER_PREVIEW_VIEWPORT_PADDING_PX,
        Math.min(
          left,
          window.innerWidth - HOVER_PREVIEW_VIEWPORT_PADDING_PX - previewWidth
        )
      );

      const preferredTop = rect.top - previewHeight - HOVER_PREVIEW_VERTICAL_GAP_PX;
      const fitsAbove = preferredTop >= HOVER_PREVIEW_VIEWPORT_PADDING_PX;
      const top = fitsAbove
        ? preferredTop
        : Math.min(
            window.innerHeight - HOVER_PREVIEW_VIEWPORT_PADDING_PX - previewHeight,
            rect.bottom + HOVER_PREVIEW_VERTICAL_GAP_PX
          );

      setHoverPreviewStyle({
        left,
        top: Math.max(HOVER_PREVIEW_VIEWPORT_PADDING_PX, top),
        maxWidth,
      });
    };

    const frameId = window.requestAnimationFrame(updatePreviewPosition);
    window.addEventListener("resize", updatePreviewPosition);
    window.addEventListener("scroll", updatePreviewPosition, true);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePreviewPosition);
      window.removeEventListener("scroll", updatePreviewPosition, true);
    };
  }, [event.title, isHoverPreviewVisible]);

  const showHoverPreview = React.useCallback(() => {
    if (isOverflowing) {
      setHoverPreviewStyle(null);
      setIsHoverPreviewVisible(true);
    }
  }, [isOverflowing]);

  const hideHoverPreview = React.useCallback(() => {
    setHoverPreviewStyle(null);
    setIsHoverPreviewVisible(false);
  }, []);

  const hoverPreviewPortalTarget =
    typeof document !== "undefined" ? document.body : null;
  const initialPreviewMaxWidthPx =
    typeof window !== "undefined"
      ? getHoverPreviewMaxWidth()
      : HOVER_PREVIEW_MAX_WIDTH_PX;
  const isCompactSymbolMatchup = isCompactSymbolMatchupTitle(event.title);
  const shouldKeepFirstWordPreview =
    isOverflowing && doesFirstWordFit && !isCompactSymbolMatchup;
  const showProfileIcon =
    isOverflowing &&
    !shouldKeepFirstWordPreview &&
    Boolean(profileIcon) &&
    !isCompactSymbolMatchup;
  const titlePaddingClass = isCompactSymbolMatchup ? "px-1" : EVENT_ITEM_PADDING_X_CLASS;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-calendar-event-id={event.id}
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
          hideHoverPreview();
          onDragStart?.(e);
        }}
        onDragEnd={() => {
          isDragCycleRef.current = false;
          hideHoverPreview();
          lastDragEndAtRef.current = performance.now();
          window.setTimeout(() => {
            onDragEnd?.();
          }, 0);
        }}
        aria-label={event.title}
        onPointerEnter={showHoverPreview}
        onPointerLeave={hideHoverPreview}
        onMouseEnter={showHoverPreview}
        onMouseLeave={hideHoverPreview}
        onFocus={showHoverPreview}
        onBlur={hideHoverPreview}
        aria-describedby={isHoverPreviewVisible ? hoverPreviewId : undefined}
        className={`group relative block w-full cursor-pointer overflow-hidden border text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.52)] transition-[transform,box-shadow,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${titlePaddingClass} ${EVENT_ITEM_TEXT_CLASS} ${radius} ${
          isDragging
            ? "brightness-[0.96] saturate-[0.96]"
            : "hover:-translate-y-px hover:brightness-[0.99] hover:shadow-[0_10px_18px_-16px_rgba(15,23,42,0.32),inset_0_1px_0_rgba(255,255,255,0.62)]"
        } ${className ?? ""}`}
        style={{
          backgroundColor: colorToken.eventSoft,
          borderColor: colorToken.eventBorder,
          color: colorToken.text,
        }}
      >
        <span
          ref={textRef}
          aria-hidden={showProfileIcon ? "true" : undefined}
          className={`block truncate ${EVENT_ITEM_LINE_HEIGHT_CLASS} ${
            isCompactSymbolMatchup ? "text-center tracking-normal" : ""
          } ${
            showProfileIcon ? "invisible" : ""
          }`}
          style={{
            minHeight: `${EVENT_ITEM_HEIGHT_PX}px`,
            fontFamily: isCompactSymbolMatchup
              ? COMPACT_SYMBOL_FONT_FAMILY
              : undefined,
          }}
        >
          {event.title}
        </span>
        {showProfileIcon && profileIcon ? (
          <span
            className="pointer-events-none absolute inset-0 grid place-items-center"
            style={{ color: colorToken.text }}
          >
            <ProfileIcon
              icon={profileIcon}
              size={12}
              className="drop-shadow-[0_1px_1px_rgba(255,255,255,0.42)]"
            />
          </span>
        ) : null}
      </button>

      {hoverPreviewPortalTarget && isHoverPreviewVisible
        ? createPortal(
            <div
              ref={previewRef}
              id={hoverPreviewId}
              role="tooltip"
              className={`pointer-events-none fixed z-[120] inline-block rounded-[10px] border border-border/80 border-l-[5px] bg-popover/98 px-3 py-2 text-left text-popover-foreground shadow-[0_22px_45px_-22px_rgba(15,23,42,0.48)] backdrop-blur ${EVENT_ITEM_TEXT_CLASS}`}
              style={{
                left: hoverPreviewStyle?.left ?? 0,
                top: hoverPreviewStyle?.top ?? 0,
                maxWidth: hoverPreviewStyle?.maxWidth ?? initialPreviewMaxWidthPx,
                borderLeftColor: colorToken.indicator,
                visibility: hoverPreviewStyle ? "visible" : "hidden",
              }}
            >
              <span
                className="block whitespace-normal break-words leading-[1.35]"
                style={{
                  fontFamily: isCompactSymbolMatchup
                    ? COMPACT_SYMBOL_FONT_FAMILY
                    : undefined,
                }}
              >
                {event.title}
              </span>
            </div>,
            hoverPreviewPortalTarget
          )
        : null}
    </>
  );
}
