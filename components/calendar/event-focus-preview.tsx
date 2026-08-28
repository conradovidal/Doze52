"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Eye, Pencil, Repeat2, X } from "lucide-react";

import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import type {
  AnchorPoint,
  CalendarProfile,
  CalendarRenderEvent,
  CategoryItem,
  RecurrenceType,
} from "@/lib/types";

const RECURRENCE_LABEL: Record<RecurrenceType, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  yearly: "Anual",
};

const formatEventDate = (value: string) =>
  format(parseISO(value), "d 'de' MMMM", { locale: ptBR });

const formatEventRange = (event: CalendarRenderEvent) => {
  if (event.startDate === event.endDate) return formatEventDate(event.startDate);
  return `${formatEventDate(event.startDate)} – ${formatEventDate(event.endDate)}`;
};

export function EventFocusPreview({
  open,
  event,
  category,
  profile,
  anchorPoint,
  isMobile,
  returnFocusRef,
  onOpenChange,
  onEdit,
}: {
  open: boolean;
  event: CalendarRenderEvent;
  category?: CategoryItem | null;
  profile?: CalendarProfile | null;
  anchorPoint: AnchorPoint;
  isMobile: boolean;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const advancingRef = React.useRef(false);
  const isManaged = Boolean(event.calendarPackGroupId);

  const restoreFocus = React.useCallback(() => {
    if (advancingRef.current) return;
    requestAnimationFrame(() => {
      const exactTarget = returnFocusRef.current;
      if (exactTarget?.isConnected) {
        exactTarget.focus();
        return;
      }
      document
        .querySelector<HTMLElement>(
          `[data-calendar-render-event-id="${CSS.escape(event.id)}"]`
        )
        ?.focus();
    });
  }, [event.id, returnFocusRef]);

  const handleEdit = () => {
    advancingRef.current = true;
    onEdit();
  };

  React.useEffect(() => {
    if (open) advancingRef.current = false;
  }, [open]);

  const content = (
    <div className="grid gap-4">
      <header className="flex items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl border"
          style={{
            borderColor: category?.color ?? "var(--material-border)",
            background: category?.color
              ? `color-mix(in srgb, ${category.color} 18%, transparent)`
              : "var(--material-highlight)",
          }}
        >
          {profile ? (
            <ProfileIcon icon={profile.icon} size={18} />
          ) : (
            <CalendarDays className="size-[18px]" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          {isMobile ? (
            <DialogTitle className="pr-7 text-left text-lg leading-tight">
              {event.title}
            </DialogTitle>
          ) : (
            <h2
              id={titleId}
              className="pr-7 text-lg font-semibold leading-tight tracking-tight"
            >
              {event.title}
            </h2>
          )}
          {isMobile ? (
            <DialogDescription className="mt-1 text-left">
              {formatEventRange(event)}
            </DialogDescription>
          ) : (
            <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
              {formatEventRange(event)}
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-mr-2 -mt-2 rounded-full"
          aria-label="Fechar prévia"
          onClick={() => onOpenChange(false)}
        >
          <X />
        </Button>
      </header>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {profile ? (
          <span className="rounded-full border border-border/70 bg-background/55 px-2.5 py-1">
            {profile.name}
          </span>
        ) : null}
        {category ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/55 px-2.5 py-1">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: category.color }}
              aria-hidden="true"
            />
            {category.name}
          </span>
        ) : null}
        {event.recurrenceType ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/55 px-2.5 py-1">
            <Repeat2 className="size-3" aria-hidden="true" />
            {RECURRENCE_LABEL[event.recurrenceType]}
          </span>
        ) : null}
        {isManaged ? (
          <span className="rounded-full border border-border/70 bg-background/55 px-2.5 py-1">
            Calendário gerenciado
          </span>
        ) : null}
      </div>

      {event.notes ? (
        <p className="line-clamp-3 text-sm leading-6 text-foreground/78">
          {event.notes}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          className="doze52-focus-action h-10 rounded-xl px-4"
          onClick={handleEdit}
        >
          {isManaged ? <Eye /> : <Pencil />}
          {isManaged ? "Ver detalhes" : "Editar"}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          mobileMode="sheet"
          showCloseButton={false}
          className="doze52-material-tinted doze52-temporal-preview gap-0"
          onCloseAutoFocus={(closeEvent) => {
            closeEvent.preventDefault();
            restoreFocus();
          }}
        >
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal>
      <PopoverAnchor asChild>
        <span
          aria-hidden="true"
          className="pointer-events-none fixed size-px"
          style={{ left: anchorPoint.x, top: anchorPoint.y }}
        />
      </PopoverAnchor>
      <PopoverContent
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        side="right"
        align="center"
        sideOffset={12}
        collisionPadding={12}
        className="doze52-material-tinted doze52-temporal-preview w-[min(360px,calc(100vw-1.5rem))] p-5"
        onCloseAutoFocus={(closeEvent) => {
          closeEvent.preventDefault();
          restoreFocus();
        }}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
