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

// Tempo de "espera" sobre o dia extremo do mês antes de virar de página.
// Curto o suficiente para parecer fluído, longo o suficiente para não virar
// sozinho ao simplesmente passar o ponteiro de raspão pelo dia.
const EDGE_HOLD_MS = 420;

function formatRangeLabel(startDate: string, endDate: string) {
  if (!startDate) return "Selecionar data";
  const start = parseIsoLocal(startDate);
  const dayPart = (date: Date) => `${date.getDate()} ${fmtMonthLabel(date)}`;
  if (!endDate || endDate === startDate) {
    return dayPart(start);
  }
  const end = parseIsoLocal(endDate);
  return `${dayPart(start)} – ${dayPart(end)}`;
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
  const [monthDirection, setMonthDirection] = React.useState<1 | -1>(1);
  const pointerDownIsoRef = React.useRef<string | null>(null);
  const hasDraggedRef = React.useRef(false);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const edgeHoldRef = React.useRef<{ iso: string; timeoutId: number } | null>(null);
  const isEdgeAdvanceRef = React.useRef(false);
  const lastPointerPosRef = React.useRef<{ x: number; y: number } | null>(null);
  // true enquanto o mês exibido não deve animar a troca — reseta a cada
  // abertura do popover (aquele grid inicial não deve competir com a própria
  // animação de entrada do popover) e só vira false quando o mês muda por
  // uma ação explícita (seta ou segurar na borda ao arrastar).
  const skipMonthAnimRef = React.useRef(true);

  const clearEdgeHold = React.useCallback(() => {
    if (edgeHoldRef.current) {
      window.clearTimeout(edgeHoldRef.current.timeoutId);
      edgeHoldRef.current = null;
    }
  }, []);

  const openPicker = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      skipMonthAnimRef.current = true;
      setPickingEnd(false);
      setVisibleMonth(startOfMonth(startDate ? parseIsoLocal(startDate) : new Date()));
    }
  };

  const goToMonth = (direction: 1 | -1) => {
    skipMonthAnimRef.current = false;
    setMonthDirection(direction);
    setVisibleMonth((month) => addMonths(month, direction));
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
  const realMonthDays = monthDays.filter((d) => !isPlaceholder(d));
  const firstDayIso = realMonthDays.length ? fmtIsoDate(realMonthDays[0]) : null;
  const lastDayIso = realMonthDays.length
    ? fmtIsoDate(realMonthDays[realMonthDays.length - 1])
    : null;

  const scheduleEdgeAdvance = React.useCallback(
    (dayIso: string, direction: 1 | -1) => {
      if (edgeHoldRef.current?.iso === dayIso) return;
      clearEdgeHold();
      const timeoutId = window.setTimeout(() => {
        edgeHoldRef.current = null;
        isEdgeAdvanceRef.current = true;
        skipMonthAnimRef.current = false;
        setMonthDirection(direction);
        setVisibleMonth((month) => addMonths(month, direction));
      }, EDGE_HOLD_MS);
      edgeHoldRef.current = { iso: dayIso, timeoutId };
    },
    [clearEdgeHold]
  );

  const handleDayPointerDown = (dayIso: string) => {
    pointerDownIsoRef.current = dayIso;
    hasDraggedRef.current = false;
    clearEdgeHold();
  };

  const handleDayPointerEnter = (dayIso: string) => {
    const anchorIso = pointerDownIsoRef.current;
    if (!anchorIso) return;
    if (dayIso !== anchorIso) {
      hasDraggedRef.current = true;
      const [rangeStart, rangeEnd] =
        anchorIso <= dayIso ? [anchorIso, dayIso] : [dayIso, anchorIso];
      onChangeRef.current({ startDate: rangeStart, endDate: rangeEnd });
    }
    // Só vira o mês depois de um arraste de verdade, nunca num simples
    // clique parado sobre o último/primeiro dia (evita virada sem querer).
    if (!hasDraggedRef.current) {
      clearEdgeHold();
      return;
    }
    if (lastDayIso && dayIso === lastDayIso) {
      scheduleEdgeAdvance(dayIso, 1);
    } else if (firstDayIso && dayIso === firstDayIso) {
      scheduleEdgeAdvance(dayIso, -1);
    } else {
      clearEdgeHold();
    }
  };

  const handleDaysGridPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    lastPointerPosRef.current = { x: event.clientX, y: event.clientY };
  };

  // Ao virar de página por causa do "hold" na borda, o ponteiro fica parado
  // sobre a tela enquanto o grid é substituído por baixo dele — sem isto o
  // arraste "trava" até a pessoa mexer o mouse de novo. Reencontramos o dia
  // que ficou sob o ponteiro e retomamos a seleção nele, mantendo o gesto
  // fluído através da virada de mês.
  React.useEffect(() => {
    if (!isEdgeAdvanceRef.current) return;
    isEdgeAdvanceRef.current = false;
    if (!pointerDownIsoRef.current) return;
    const pos = lastPointerPosRef.current;
    if (!pos) return;
    const el = document.elementFromPoint(pos.x, pos.y);
    const dayIso = el?.closest<HTMLElement>("[data-day-iso]")?.getAttribute("data-day-iso");
    if (dayIso) {
      handleDayPointerEnter(dayIso);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonth]);

  React.useEffect(() => {
    const handleWindowPointerUp = () => {
      const anchorIso = pointerDownIsoRef.current;
      if (!anchorIso) return;
      const wasDrag = hasDraggedRef.current;
      pointerDownIsoRef.current = null;
      hasDraggedRef.current = false;
      clearEdgeHold();
      if (wasDrag) {
        setPickingEnd(false);
        setOpen(false);
        return;
      }
      handlePickDay(anchorIso);
    };
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => window.removeEventListener("pointerup", handleWindowPointerUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickingEnd, startDate, clearEdgeHold]);

  React.useEffect(() => clearEdgeHold, [clearEdgeHold]);

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
            onClick={() => goToMonth(-1)}
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
            onClick={() => goToMonth(1)}
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
        <div className="overflow-hidden">
          <div
            key={`${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`}
            className={cn(
              "grid grid-cols-7 gap-1",
              !skipMonthAnimRef.current &&
                (monthDirection === 1
                  ? "animate-in fade-in-0 slide-in-from-right-2 duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  : "animate-in fade-in-0 slide-in-from-left-2 duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]")
            )}
            onPointerMove={handleDaysGridPointerMove}
          >
            {monthDays.map((d, index) => {
              if (isPlaceholder(d)) {
                return <div key={`blank-${index}`} />;
              }
              const dayIso = fmtIsoDate(d);
              const isSelected =
                Boolean(startDate) && dayIso >= startDate && dayIso <= (endDate || startDate);
              return (
                <button
                  key={dayIso}
                  type="button"
                  data-day-iso={dayIso}
                  onPointerDown={() => handleDayPointerDown(dayIso)}
                  onPointerEnter={() => handleDayPointerEnter(dayIso)}
                  className={cn(
                    "grid h-7 place-items-center rounded-lg text-[12px] transition-colors select-none touch-none",
                    isSelected
                      ? "bg-foreground text-background font-semibold"
                      : "text-foreground/78 hover:bg-muted/70"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
        <p className="pt-2 text-center text-[10.5px] text-muted-foreground">
          clique um dia, ou arraste até o dia final
        </p>
      </PopoverContent>
    </Popover>
  );
}
