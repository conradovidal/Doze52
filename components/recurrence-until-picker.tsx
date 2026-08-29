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

type RecurrenceUntilPickerProps = {
  value: string;
  onChange: (nextIso: string) => void;
  minDate?: string;
  disabled?: boolean;
  className?: string;
};

function parseIsoLocal(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

export function RecurrenceUntilPicker({
  value,
  onChange,
  minDate,
  disabled = false,
  className,
}: RecurrenceUntilPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [visibleMonth, setVisibleMonth] = React.useState(() =>
    startOfMonth(value ? parseIsoLocal(value) : minDate ? parseIsoLocal(minDate) : new Date())
  );

  const openPicker = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setVisibleMonth(
        startOfMonth(value ? parseIsoLocal(value) : minDate ? parseIsoLocal(minDate) : new Date())
      );
    }
  };

  const monthDays = getMonthDaysWithLeading(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth()
  );

  const label = value
    ? (() => {
        const date = parseIsoLocal(value);
        return `${date.getDate()} ${fmtMonthLabel(date)}`;
      })()
    : "Indeterminado";

  return (
    <Popover open={open} onOpenChange={openPicker}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-9 w-auto items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 text-[13px] font-medium text-foreground/85 shadow-sm transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60",
            className
          )}
        >
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[272px] p-3">
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
            const isSelected = dayIso === value;
            const isDisabled = Boolean(minDate) && dayIso < (minDate as string);
            return (
              <button
                key={dayIso}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  onChange(dayIso);
                  setOpen(false);
                }}
                className={cn(
                  "grid h-7 place-items-center rounded-lg text-[12px] transition-colors",
                  isSelected
                    ? "bg-foreground text-background font-semibold"
                    : isDisabled
                      ? "text-foreground/28 cursor-not-allowed"
                      : "text-foreground/78 hover:bg-muted/70"
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        {value ? (
          <button
            type="button"
            className="mt-2 w-full text-center text-[10.5px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            voltar a indeterminado
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
