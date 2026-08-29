"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

import { getCategoryColorToken } from "@/lib/category-palette";
import { getHabitCheckInKey } from "@/lib/habits-prototype";
import { useTheme } from "@/lib/theme";
import type { Habit, HabitCheckIn } from "@/lib/types";

export function HabitDayPicker({
  dateIso,
  anchor,
  habits,
  checkIns,
  onToggle,
  onClose,
}: {
  dateIso: string;
  anchor: HTMLElement;
  habits: Habit[];
  checkIns: Record<string, HabitCheckIn>;
  onToggle: (habit: Habit, dateIso: string) => void;
  onClose: () => void;
}) {
  const { mode: themeMode } = useTheme();
  const pickerRef = React.useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<React.CSSProperties>();

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!mounted) return;
    pickerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [mounted]);
  React.useLayoutEffect(() => {
    if (!mounted) return;
    const picker = pickerRef.current;
    if (!picker) return;

    const update = () => {
      if (!anchor.isConnected) {
        onClose();
        return;
      }
      const edge = 12;
      const gap = 8;
      const anchorRect = anchor.getBoundingClientRect();
      const pickerRect = picker.getBoundingClientRect();
      const canUseRight =
        anchorRect.right + gap + pickerRect.width + edge <= window.innerWidth;
      const preferredLeft = canUseRight
        ? anchorRect.right + gap
        : anchorRect.left - pickerRect.width - gap;
      setPosition({
        left: Math.min(
          Math.max(edge, preferredLeft),
          window.innerWidth - pickerRect.width - edge
        ),
        top: Math.min(
          Math.max(edge, anchorRect.top + (anchorRect.height - pickerRect.height) / 2),
          window.innerHeight - pickerRect.height - edge
        ),
      });
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    observer.observe(picker);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, mounted, onClose]);

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (pickerRef.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchor, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div
      ref={pickerRef}
      role="dialog"
      aria-label={`Registrar hábitos em ${dateIso}`}
      data-habit-day-picker
      className={`fixed z-[95] flex items-center gap-1.5 rounded-xl border border-border bg-card p-2 shadow-[0_18px_44px_-20px_rgba(15,23,42,0.7)] ${
        position ? "opacity-100" : "opacity-0"
      }`}
      style={position}
    >
      {habits.map((habit) => {
        const completed = Boolean(
          checkIns[getHabitCheckInKey(habit.id, dateIso)]?.completed
        );
        const colorToken = getCategoryColorToken(habit.color, themeMode);
        return (
          <button
            key={habit.id}
            type="button"
            aria-label={`${completed ? "Desmarcar" : "Marcar"} ${habit.name}`}
            aria-pressed={completed}
            title={habit.name}
            className="grid size-8 place-items-center rounded-full border border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            style={{ backgroundColor: colorToken.indicator }}
            onClick={() => onToggle(habit, dateIso)}
          >
            {completed ? (
              <Check className="size-4 text-neutral-950" strokeWidth={2.8} />
            ) : null}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
