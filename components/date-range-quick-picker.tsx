"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, startOfMonth } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  fmtIsoDate,
  fmtMonthLabel,
  getMonthDaysWithLeading,
  isPlaceholder,
  weekdayAbbr,
} from "@/lib/date";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

type DateRangeQuickPickerProps = {
  startDate: string;
  endDate: string;
  onChange: (next: { startDate: string; endDate: string }) => void;
  disabled?: boolean;
  className?: string;
};

function parseIsoLocal(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function formatRangeLabel(startDate: string, endDate: string) {
  if (!startDate) return "Selecionar data";
  const start = parseIsoLocal(startDate);
  const dayPart = (date: Date) =>
    `${weekdayAbbr[date.getDay()]}, ${date.getDate()} ${fmtMonthLabel(date)}`;
  if (!endDate || endDate === startDate) {
    return dayPart(start);
  }
  const end = parseIsoLocal(endDate);
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return `${dayPart(start)} → ${dayPart(end)} · ${dayCount} dias`;
}

export function DateRangeQuickPicker({
  startDate,
  endDate,
  onChange,
  disabled = false,
  className,
}: DateRangeQuickPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [pickingEnd, setPickingEnd] = React.useState(false);
  const [visibleMonth, setVisibleMonth] = React.useState(() =>
    startOfMonth(startDate ? parseIsoLocal(startDate) : new Date())
  );

  const openPicker = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setPickingEnd(false);
      setVisibleMonth(startOfMonth(startDate ? parseIsoLocal(startDate) : new Date()));
    }
  };

  const handlePickDay = (dayIso: string) => {
    if (!pickingEnd) {
      onChange({ startDate: dayIso, endDate: dayIso });
      setPickingEnd(true);
      return;
    }
    if (dayIso >= startDate) {
      onChange({ startDate, endDate: dayIso });
    } else {
      onChange({ startDate: dayIso, endDate: dayIso });
      setPickingEnd(true);
      return;
    }
    setPickingEnd(false);
    setOpen(false);
  };

  const monthDays = getMonthDaysWithLeading(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth()
  );

  return (
    <Popover open={open} onOpenChange={openPicker}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-8 w-auto items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 text-[12.5px] font-semibold text-foreground/85 shadow-none transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60",
            className
          )}
        >
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatRangeLabel(startDate, endDate)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[272px] p-3">
        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            aria-label="Mês anterior"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-[13px] font-semibold text-foreground">
            {MONTH_NAMES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 pb-1">
          {weekdayAbbr.map((wd) => (
            <div
              key={wd}
              className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80"
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((d, index) => {
            if (isPlaceholder(d)) {
              return <div key={`blank-${index}`} />;
            }
            const dayIso = fmtIsoDate(d);
            const isEdge = dayIso === startDate || dayIso === endDate;
            const isInRange = dayIso >= startDate && dayIso <= endDate;
            return (
              <button
                key={dayIso}
                type="button"
                onClick={() => handlePickDay(dayIso)}
                className={cn(
                  "grid h-7 place-items-center rounded-lg text-[12px] transition-colors",
                  isEdge
                    ? "bg-foreground text-background font-semibold"
                    : isInRange
                      ? "bg-muted text-foreground"
                      : "text-foreground/78 hover:bg-muted/70"
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <p className="pt-2 text-center text-[10.5px] text-muted-foreground">
          clique um dia pra começar, outro pra fechar o intervalo
        </p>
      </PopoverContent>
    </Popover>
  );
}
