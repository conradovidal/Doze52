"use client";

import * as React from "react";
import { CalendarDays, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback-provider";
import { calendarPackGroups } from "@/lib/calendar-packs";
import {
  getCalendarPackAvailability,
  importCalendarPack,
  removeCalendarPack,
} from "@/lib/calendar-packs/import";
import type { CalendarPack } from "@/lib/calendar-packs/types";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type PackFlowState =
  | "idle"
  | "partial"
  | "adding"
  | "added"
  | "exists"
  | "removing"
  | "removed"
  | "error";

const statusCopy: Record<PackFlowState, string> = {
  idle: "Disponível",
  partial: "Atualização",
  adding: "Adicionando...",
  added: "Adicionado",
  exists: "Adicionado",
  removing: "Removendo...",
  removed: "Removido",
  error: "Erro",
};

const formatVerifiedDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
};

const MOBILE_LAUNCHER_STYLE = {
  height: "2.5rem",
  minHeight: "2.5rem",
} satisfies React.CSSProperties;
const MOBILE_PACK_LABEL = "Mais calendários";

export function CalendarPackLauncher({
  onFocusYear,
  className,
  mobileDense = false,
}: {
  onFocusYear?: (year: number) => void;
  className?: string;
  mobileDense?: boolean;
}) {
  const { notify } = useFeedback();
  const profiles = useStore((state) => state.profiles);
  const categories = useStore((state) => state.categories);
  const events = useStore((state) => state.events);
  const replaceAllData = useStore((state) => state.replaceAllData);
  const setSelectedProfiles = useStore((state) => state.setSelectedProfiles);

  const [open, setOpen] = React.useState(false);
  const [flowByPack, setFlowByPack] = React.useState<Record<string, PackFlowState>>({});

  const snapshot = React.useMemo(
    () => ({ profiles, categories, events }),
    [categories, events, profiles]
  );

  const availabilityByPack = React.useMemo(
    () =>
      new Map(
        calendarPackGroups.flatMap((group) =>
          group.packs.map((pack) => [
            pack.id,
            getCalendarPackAvailability(snapshot, pack),
          ])
        )
      ),
    [snapshot]
  );
  const packUpdateCount = React.useMemo(
    () =>
      calendarPackGroups
        .flatMap((group) => group.packs)
        .filter((pack) => {
          const availability = availabilityByPack.get(pack.id);
          if (!availability) return false;
          const isPresent =
            Boolean(availability.hasAnyCategory) ||
            Boolean(availability.hasImportedEvents);
          const isComplete =
            availability.importedEventCount >= availability.totalEventCount &&
            !availability.hasMismatchedEvents;
          return isPresent && !isComplete;
        }).length,
    [availabilityByPack]
  );
  const hasPackUpdates = packUpdateCount > 0;
  const updateAriaCopy =
    packUpdateCount === 1
      ? "1 atualização disponível"
      : `${packUpdateCount} atualizações disponíveis`;

  const setPackFlow = React.useCallback((packId: string, state: PackFlowState) => {
    setFlowByPack((current) => ({ ...current, [packId]: state }));
  }, []);

  const focusPack = React.useCallback(
    (pack: CalendarPack, profileId: string | null) => {
      if (profileId) {
        setSelectedProfiles([profileId]);
      }
      onFocusYear?.(pack.year);
    },
    [onFocusYear, setSelectedProfiles]
  );

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFlowByPack({});
    }
  }, []);

  const handleImport = React.useCallback(
    (pack: CalendarPack) => {
      setPackFlow(pack.id, "adding");

      try {
        const result = importCalendarPack(snapshot, pack, "all");
        replaceAllData(result.snapshot);
        focusPack(pack, result.profileId);

        if (result.status === "already-exists") {
          setPackFlow(pack.id, "exists");
          notify({
            tone: "success",
            title: "Calendário já adicionado",
            description: "A categoria existente foi aberta sem duplicar eventos.",
          });
          return;
        }

        setPackFlow(pack.id, "added");
        notify({
          tone: "success",
          title:
            result.status === "updated"
              ? "Calendário atualizado"
              : "Calendário adicionado",
          description: `${pack.name} entrou no seu Doze 52.`,
        });
      } catch {
        setPackFlow(pack.id, "error");
        notify({
          tone: "error",
          title: "Erro ao adicionar calendário",
          description: "Tente novamente em instantes.",
        });
      }
    },
    [focusPack, notify, replaceAllData, setPackFlow, snapshot]
  );

  const handleRemove = React.useCallback(
    (pack: CalendarPack) => {
      setPackFlow(pack.id, "removing");

      try {
        const result = removeCalendarPack(snapshot, pack);
        replaceAllData(result.snapshot);
        onFocusYear?.(pack.year);
        setPackFlow(pack.id, "removed");
        notify({
          tone: "success",
          title: "Calendário removido",
          description: `${pack.name} saiu do seu Doze 52.`,
        });
      } catch {
        setPackFlow(pack.id, "error");
        notify({
          tone: "error",
          title: "Erro ao remover calendário",
          description: "Tente novamente em instantes.",
        });
      }
    },
    [notify, onFocusYear, replaceAllData, setPackFlow, snapshot]
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        style={mobileDense ? MOBILE_LAUNCHER_STYLE : undefined}
        className={cn(
          "relative h-8 rounded-full border-border/55 bg-background/70 px-2.5 text-[0.78rem] font-medium text-foreground/78 shadow-none transition-all hover:border-border/75 hover:bg-muted/35 hover:text-foreground",
          mobileDense &&
            "!h-10 justify-start gap-2 overflow-hidden rounded-[8px] !border-foreground !bg-foreground px-2.5 py-1 !text-background shadow-none whitespace-normal hover:!bg-foreground/92 hover:!text-background dark:!border-white/80 dark:!bg-white dark:!text-black dark:hover:!bg-white/92 dark:hover:!text-black",
          hasPackUpdates &&
            "border-amber-400/60 text-foreground hover:border-amber-400/75",
          className
        )}
        onClick={() => setOpen(true)}
        aria-label={
          hasPackUpdates
            ? `Abrir ${MOBILE_PACK_LABEL}. Destaque: Copa 2026. ${updateAriaCopy}`
            : `Abrir ${MOBILE_PACK_LABEL}. Destaque: Copa 2026.`
        }
        title={hasPackUpdates ? "Atualizações disponíveis" : undefined}
      >
        {hasPackUpdates ? (
          <span
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-amber-400 ring-2 ring-background"
            aria-hidden="true"
          />
        ) : null}
        {mobileDense ? (
          <span className="grid size-6 shrink-0 place-items-center self-center rounded-[7px] bg-background/14 text-[17px] font-semibold leading-none text-background dark:!bg-black/10 dark:!text-black">
            +
          </span>
        ) : (
          <CalendarDays className="size-3.5" />
        )}
        <span
          className={cn(
            mobileDense
              ? "min-w-0 self-center text-left text-[0.72rem] font-semibold leading-[0.9rem]"
              : ""
          )}
        >
          {mobileDense ? (
            <>
              <span className="block">Calendários</span>
              <span className="block text-[9px] font-semibold uppercase leading-[0.68rem] tracking-[0.08em] text-emerald-200/90 dark:!text-emerald-700">
                🇧🇷 Copa 2026
              </span>
            </>
          ) : (
            "Pacotes"
          )}
        </span>
        {!mobileDense ? (
          <span className="hidden items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 sm:inline-flex">
            <span aria-hidden="true">🇧🇷</span>
            Copa
          </span>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader className="pr-8">
            <DialogTitle>Pacotes de calendários</DialogTitle>
            <DialogDescription>
              Adicione, remova ou atualize categorias prontas. Atualizar preserva o perfil onde elas estão.
            </DialogDescription>
          </DialogHeader>

          {hasPackUpdates ? (
            <div className="rounded-[8px] border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
              Há atualizações disponíveis para calendários já adicionados.
            </div>
          ) : null}

          <div className="grid gap-3">
            {calendarPackGroups.map((group) => (
              <section
                key={group.id}
                className="rounded-[8px] border border-border/75 bg-background p-3 shadow-sm"
              >
                <div className="mb-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {group.badge ? (
                        <span aria-hidden="true">{group.badge}</span>
                      ) : null}
                      {group.title}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {group.description}
                    </p>
                    {group.packs[0]?.source ? (
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground/82">
                        Dados verificados em{" "}
                        {formatVerifiedDate(group.packs[0].source.lastVerified)}
                        {" · "}Fonte: {group.packs[0].source.label}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  {group.packs.map((pack) => {
                    const availability = availabilityByPack.get(pack.id);
                    const importedEventCount = availability?.importedEventCount ?? 0;
                    const totalEventCount = availability?.totalEventCount ?? pack.events.length;
                    const isComplete =
                      importedEventCount >= totalEventCount &&
                      !availability?.hasMismatchedEvents;
                    const isPresent =
                      Boolean(availability?.hasAnyCategory) ||
                      Boolean(availability?.hasImportedEvents);
                    const currentFlow = flowByPack[pack.id] ?? "idle";
                    const displayedState =
                      currentFlow !== "idle"
                        ? currentFlow
                        : isPresent
                          ? isComplete
                            ? "exists"
                            : "partial"
                          : "idle";
                    const isBusy =
                      displayedState === "adding" || displayedState === "removing";

                    return (
                      <article
                        key={pack.id}
                        className="flex flex-col gap-2 rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-medium text-foreground">
                              {pack.name}
                            </h4>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px]",
                                displayedState === "error"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {isBusy ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Loader2 className="size-3 animate-spin" />
                                  {statusCopy[displayedState]}
                                </span>
                              ) : (
                                statusCopy[displayedState]
                              )}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {pack.description}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                          {isPresent ? (
                            <>
                              {!isComplete ? (
                                <Button
                                  type="button"
                                  variant="premium"
                                  size="xs"
                                  className="rounded-full"
                                  disabled={isBusy}
                                  onClick={() => handleImport(pack)}
                                >
                                  Atualizar
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  className="rounded-full"
                                  onClick={() => focusPack(pack, availability?.profileId ?? null)}
                                >
                                  Ver
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="dangerSoft"
                                size="xs"
                                className="rounded-full"
                                disabled={isBusy}
                                onClick={() => handleRemove(pack)}
                              >
                                <Trash2 className="size-3.5" />
                                Remover
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="premium"
                              size="xs"
                              className="rounded-full"
                              disabled={isBusy}
                              onClick={() => handleImport(pack)}
                            >
                              {displayedState === "adding" ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : null}
                              Adicionar
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
