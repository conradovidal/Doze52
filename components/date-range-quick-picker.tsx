"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, differenceInCalendarDays, startOfMonth } from "date-fns";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
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

// Qual ponta do período o calendário aberto está escolhendo.
type PickerMode = "start" | "end";

function parseIsoLocal(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

// Tempo de "espera" sobre o dia extremo do mês antes de virar de página.
// Curto o suficiente para parecer fluído, longo o suficiente para não virar
// sozinho ao simplesmente passar o ponteiro de raspão pelo dia.
const EDGE_HOLD_MS = 420;

// Rótulo da pílula: sem dia da semana, para caber na linha do contexto e da
// categoria — o dia da semana aparece nas abas do calendário.
function formatPillLabel(startDate: string, endDate: string) {
  if (!startDate) return "Data";
  const short = (iso: string) => {
    const date = parseIsoLocal(iso);
    return `${date.getDate()} ${fmtMonthLabel(date)}`;
  };
  if (!endDate || endDate <= startDate) return short(startDate);
  return `${short(startDate)} – ${short(endDate)}`;
}

function formatDayLabel(iso: string) {
  const date = parseIsoLocal(iso);
  return `${weekdayAbbr[date.getDay()]}, ${date.getDate()} ${fmtMonthLabel(date)}`;
}

// A data é uma pílula como contexto e categoria ("28 set" ou "28 set – 2 out").
// Ao tocar, o calendário abre com abas Início e Fim no topo: o fim é opcional
// (como o "End date" do Notion) e cada aba escolhe a sua ponta — um toque por
// decisão. Antes o calendário pedia "clique um dia, ou arraste até o dia
// final": o arrastar não funciona com o dedo (o toque fica preso ao dia onde
// começou) e o segundo toque para marcar o fim não era descobrível. O arrastar continua existindo no calendário de início para
// quem usa mouse, como atalho.
export function DateRangeQuickPicker({
  startDate,
  endDate,
  onChange,
  disabled = false,
  className,
}: DateRangeQuickPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<PickerMode>("start");
  const [visibleMonth, setVisibleMonth] = React.useState(() =>
    startOfMonth(startDate ? parseIsoLocal(startDate) : new Date())
  );
  const [monthDirection, setMonthDirection] = React.useState<1 | -1>(1);
  const groupRef = React.useRef<HTMLButtonElement | null>(null);
  const pointerDownIsoRef = React.useRef<string | null>(null);
  const hasDraggedRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);
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

  const hasRange = Boolean(startDate && endDate && endDate > startDate);
  const dayCount = hasRange
    ? differenceInCalendarDays(parseIsoLocal(endDate), parseIsoLocal(startDate)) + 1
    : 1;

  const clearEdgeHold = React.useCallback(() => {
    if (edgeHoldRef.current) {
      window.clearTimeout(edgeHoldRef.current.timeoutId);
      edgeHoldRef.current = null;
    }
  }, []);

  const openFor = (nextMode: PickerMode) => {
    if (open && mode === nextMode) {
      setOpen(false);
      return;
    }
    const focusIso =
      nextMode === "end" ? (hasRange ? endDate : startDate) : startDate;
    const nextMonth = startOfMonth(focusIso ? parseIsoLocal(focusIso) : new Date());
    // Trocar de ponta com o calendário já aberto anima a virada de mês como
    // as setas; abrir do zero não (a entrada do popover já é o movimento).
    skipMonthAnimRef.current = !open;
    if (open && nextMonth.getTime() !== visibleMonth.getTime()) {
      setMonthDirection(nextMonth > visibleMonth ? 1 : -1);
    }
    setMode(nextMode);
    setVisibleMonth(nextMonth);
    setOpen(true);
  };

  const goToMonth = (direction: 1 | -1) => {
    skipMonthAnimRef.current = false;
    setMonthDirection(direction);
    setVisibleMonth((month) => addMonths(month, direction));
  };

  const handlePickDay = (dayIso: string) => {
    if (mode === "start") {
      // Mantém o fim quando ele ainda vem depois do novo início; se não,
      // o evento volta a ser de um dia só.
      const keepEnd = hasRange && endDate >= dayIso;
      onChange({ startDate: dayIso, endDate: keepEnd ? endDate : dayIso });
    } else {
      if (dayIso < startDate) return;
      onChange({ startDate, endDate: dayIso });
    }
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

  const handleDayPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    dayIso: string
  ) => {
    suppressClickRef.current = false;
    // Arrastar só com mouse/caneta: no toque, o dedo fica preso ao dia onde
    // começou e o gesto nunca chega aos outros dias.
    if (mode !== "start" || event.pointerType === "touch") return;
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
      if (!pointerDownIsoRef.current) return;
      const wasDrag = hasDraggedRef.current;
      pointerDownIsoRef.current = null;
      hasDraggedRef.current = false;
      clearEdgeHold();
      if (wasDrag) {
        // O período já foi aplicado durante o arraste; o click que o
        // navegador ainda dispara (se o gesto voltou ao dia de origem) não
        // deve desfazê-lo.
        suppressClickRef.current = true;
        setOpen(false);
      }
    };
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => window.removeEventListener("pointerup", handleWindowPointerUp);
  }, [clearEdgeHold]);

  React.useEffect(() => clearEdgeHold, [clearEdgeHold]);

  const tabClass = (segment: PickerMode) =>
    cn(
      "flex min-w-0 flex-col items-start gap-0.5 rounded-[10px] px-2.5 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
      mode === segment
        ? "bg-background shadow-[0_1px_2px_rgba(15,23,42,0.12)] ring-1 ring-border"
        : "hover:bg-muted/70"
    );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setOpen(false);
      }}
    >
      {/* Mesma altura e forma das pílulas de contexto e categoria, na
          mesma linha: só o dia ("28 set") ou o período enxuto
          ("28 set – 2 out"). Início, fim e "voltar a um dia" são geridos
          dentro do calendário que ela abre. */}
      <PopoverAnchor asChild>
        <button
          ref={groupRef}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={
            startDate
              ? hasRange
                ? `Datas: ${formatDayLabel(startDate)} a ${formatDayLabel(endDate)}, ${dayCount} dias`
                : `Data: ${formatDayLabel(startDate)}`
              : "Escolher data"
          }
          className={cn(
            "inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 text-[12.5px] font-semibold text-foreground/85 shadow-none transition-colors hover:bg-muted/70 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
            className
          )}
          onClick={() => (open ? setOpen(false) : openFor("start"))}
        >
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatPillLabel(startDate, endDate)}</span>
        </button>
      </PopoverAnchor>
      {/* A pílula fica no fim da linha do editor: o calendário se alinha
          pela direita dela e respeita uma margem da borda da tela. */}
      <PopoverContent
        align="end"
        collisionPadding={12}
        aria-label={mode === "start" ? "Escolher início" : "Escolher fim"}
        className="w-[min(19rem,calc(100vw-2rem))] p-3"
        // O foco fica na pílula que abriu o calendário: no celular, mover o
        // foco para o popover reabriria o teclado virtual.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // Tocar na pílula com o calendário aberto fecha pelo próprio
          // clique dela, sem fechar aqui e reabrir no clique.
          const target = event.target;
          if (target instanceof Node && groupRef.current?.contains(target)) {
            event.preventDefault();
          }
        }}
      >
        {/* Início e Fim explícitos só aqui dentro, como abas: deixa claro
            qual ponta o calendário está escolhendo sem ocupar o editor. */}
        <div
          role="tablist"
          aria-label="Ponta do período"
          className="mb-2 grid grid-cols-2 gap-0.5 rounded-xl bg-muted/50 p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "start"}
            className={tabClass("start")}
            onClick={() => mode !== "start" && openFor("start")}
          >
            <span className="text-[10px] font-medium leading-none text-muted-foreground">
              Início
            </span>
            <span className="max-w-full truncate text-[12.5px] font-semibold leading-4 text-foreground">
              {startDate ? formatDayLabel(startDate) : "—"}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "end"}
            disabled={!startDate}
            className={tabClass("end")}
            onClick={() => mode !== "end" && openFor("end")}
          >
            <span className="text-[10px] font-medium leading-none text-muted-foreground">
              {hasRange ? `Fim · ${dayCount} dias` : "Fim"}
            </span>
            <span
              className={cn(
                "max-w-full truncate text-[12.5px] leading-4",
                hasRange
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted-foreground"
              )}
            >
              {hasRange ? formatDayLabel(endDate) : "Mesmo dia"}
            </span>
          </button>
        </div>
        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            aria-label="Mês anterior"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
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
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
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
              "grid grid-cols-7 gap-y-1",
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
              const rangeEnd = endDate || startDate;
              const isEndpoint =
                Boolean(startDate) && (dayIso === startDate || dayIso === rangeEnd);
              const isInside =
                Boolean(startDate) && dayIso > startDate && dayIso < rangeEnd;
              const beforeStart = mode === "end" && Boolean(startDate) && dayIso < startDate;
              return (
                <button
                  key={dayIso}
                  type="button"
                  data-day-iso={dayIso}
                  disabled={beforeStart}
                  aria-pressed={isEndpoint || isInside}
                  aria-label={formatDayLabel(dayIso)}
                  onPointerDown={(event) => handleDayPointerDown(event, dayIso)}
                  onPointerEnter={() => handleDayPointerEnter(dayIso)}
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    handlePickDay(dayIso);
                  }}
                  className={cn(
                    "grid h-9 place-items-center text-[13px] tabular-nums transition-colors select-none md:h-8 md:text-[12px]",
                    isEndpoint
                      ? "rounded-lg bg-foreground font-semibold text-background"
                      : isInside
                        ? "bg-foreground/12 font-medium text-foreground"
                        : "rounded-lg text-foreground/78 hover:bg-muted/70",
                    beforeStart && "cursor-not-allowed text-foreground/25 hover:bg-transparent"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
        {mode === "end" && hasRange ? (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => {
                setOpen(false);
                onChange({ startDate, endDate: startDate });
              }}
            >
              Voltar para um dia só
            </button>
          </div>
        ) : (
          <p className="pt-2 text-center text-[11px] text-muted-foreground">
            {mode === "start" ? (
              <>
                Escolha o dia de início
                <span className="hidden md:inline"> — ou arraste até o último dia</span>
              </>
            ) : (
              "Escolha o último dia"
            )}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
