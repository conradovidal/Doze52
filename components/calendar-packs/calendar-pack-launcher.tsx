"use client";

import * as React from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calendarPacks } from "@/lib/calendar-packs";
import {
  getCalendarPackAvailability,
  importCalendarPack,
  removeCalendarPack,
} from "@/lib/calendar-packs/import";
import type { CalendarPack } from "@/lib/calendar-packs/types";
import { isLimitReached } from "@/lib/entitlements";
import { useStore } from "@/lib/store";
import { useBilling } from "@/lib/use-billing";
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

export function CalendarPackLauncher({
  onFocusYear,
  className,
  mobileDense = false,
  onRequireAuth,
}: {
  onFocusYear?: (year: number) => void;
  className?: string;
  mobileDense?: boolean;
  onRequireAuth?: () => void;
}) {
  const { notify } = useFeedback();
  const { isPro, limits } = useBilling();
  const profiles = useStore((state) => state.profiles);
  const categories = useStore((state) => state.categories);
  const events = useStore((state) => state.events);
  const replaceAllData = useStore((state) => state.replaceAllData);
  const selectedProfileIds = useStore((state) => state.selectedProfileIds);
  const setSelectedProfiles = useStore((state) => state.setSelectedProfiles);

  const [open, setOpen] = React.useState(false);
  const [flowByPack, setFlowByPack] = React.useState<Record<string, PackFlowState>>({});
  const [targetProfileByPack, setTargetProfileByPack] = React.useState<
    Record<string, string>
  >({});
  const [expandedPackId, setExpandedPackId] = React.useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = React.useState(false);

  const snapshot = React.useMemo(
    () => ({ profiles, categories, events }),
    [categories, events, profiles]
  );

  const availabilityByPack = React.useMemo(
    () =>
      new Map(
        calendarPacks.map((pack) => [
          pack.id,
          getCalendarPackAvailability(snapshot, pack),
        ])
      ),
    [snapshot]
  );
  const packUpdateCount = React.useMemo(
    () =>
      calendarPacks.filter((pack) => {
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
  const subscribedPackCount = React.useMemo(
    () =>
      calendarPacks.filter((pack) => {
        const availability = availabilityByPack.get(pack.id);
        return (
          Boolean(availability?.hasAnyCategory) ||
          Boolean(availability?.hasImportedEvents)
        );
      }).length,
    [availabilityByPack]
  );
  const isCalendarSubscriptionLimitReached =
    !isPro &&
    isLimitReached(subscribedPackCount, limits.maxCalendarSubscriptions);
  const updateAriaCopy =
    packUpdateCount === 1
      ? "1 atualização disponível"
      : `${packUpdateCount} atualizações disponíveis`;
  const launcherAriaCopy = hasPackUpdates
    ? `Adicionar ou gerenciar calendários. ${updateAriaCopy}`
    : "Adicionar ou gerenciar calendários. Novos calendários disponíveis.";
  const activeProfileId = React.useMemo(
    () =>
      selectedProfileIds.find((profileId) =>
        profiles.some((profile) => profile.id === profileId)
      ) ??
      profiles[0]?.id ??
      null,
    [profiles, selectedProfileIds]
  );
  const profileNameById = React.useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.name])),
    [profiles]
  );

  const getTargetProfileId = React.useCallback(
    (packId: string, fallbackProfileId?: string | null) => {
      const savedProfileId = targetProfileByPack[packId];
      if (savedProfileId && profileNameById.has(savedProfileId)) {
        return savedProfileId;
      }
      if (fallbackProfileId && profileNameById.has(fallbackProfileId)) {
        return fallbackProfileId;
      }
      return activeProfileId;
    },
    [activeProfileId, profileNameById, targetProfileByPack]
  );

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
      setExpandedPackId(null);
    }
  }, []);

  const handleImport = React.useCallback(
    (pack: CalendarPack, targetProfileId: string | null) => {
      const availability = availabilityByPack.get(pack.id);
      const isPresent =
        Boolean(availability?.hasAnyCategory) ||
        Boolean(availability?.hasImportedEvents);

      if (!isPresent && isCalendarSubscriptionLimitReached) {
        setUpgradeDialogOpen(true);
        return;
      }

      if (!targetProfileId || !profileNameById.has(targetProfileId)) {
        notify({
          tone: "error",
          title: "Escolha um perfil",
          description: "Selecione onde este calendário deve entrar.",
        });
        return;
      }

      setPackFlow(pack.id, "adding");

      try {
        const result = importCalendarPack(snapshot, pack, "all", targetProfileId);
        replaceAllData(result.snapshot);
        focusPack(pack, result.profileId);
        setExpandedPackId(null);

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
          description: `${pack.name} entrou em ${
            profileNameById.get(result.profileId) ?? "seu Doze 52"
          }.`,
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
    [
      availabilityByPack,
      focusPack,
      isCalendarSubscriptionLimitReached,
      notify,
      profileNameById,
      replaceAllData,
      setPackFlow,
      snapshot,
    ]
  );

  const handleRemove = React.useCallback(
    (pack: CalendarPack) => {
      setPackFlow(pack.id, "removing");

      try {
        const result = removeCalendarPack(snapshot, pack);
        replaceAllData(result.snapshot);
        onFocusYear?.(pack.year);
        setPackFlow(pack.id, "removed");
        setExpandedPackId(null);
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
        size={mobileDense ? "lg" : "sm"}
        className={cn(
          "relative rounded-[10px] border-border bg-card text-[0.78rem] font-semibold text-foreground shadow-none transition-[background-color,border-color,box-shadow,transform,color] duration-150 ease-out hover:border-foreground/18 hover:bg-muted hover:text-foreground active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-ring/45",
          mobileDense
            ? "h-10 justify-start rounded-[8px] text-left"
            : "h-8 px-2.5 pr-3 md:h-9 md:px-3 md:pr-3.5 md:text-sm",
          className
        )}
        onClick={() => setOpen(true)}
        aria-label={launcherAriaCopy}
        title={
          hasPackUpdates
            ? "Atualizações disponíveis"
            : "Calendários disponíveis"
        }
      >
        <Plus className="size-3.5 text-muted-foreground" />
        <span>Calendários</span>
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 size-2 rounded-full border-[1.5px] border-card bg-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.16)] dark:border-background"
        />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Calendários</DialogTitle>
            <DialogDescription>
              Adicione calendários prontos ao seu ano.
            </DialogDescription>
          </DialogHeader>

          {hasPackUpdates ? (
            <div className="rounded-[8px] border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-700 dark:border-rose-300/25 dark:bg-rose-400/10 dark:text-rose-200">
              Há atualizações disponíveis para calendários já adicionados.
            </div>
          ) : null}

          <div className="grid gap-2 rounded-[8px] border border-border/75 bg-background p-2.5 shadow-sm sm:p-3">
            {calendarPacks.map((pack) => {
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
                    const targetProfileId = getTargetProfileId(
                      pack.id,
                      availability?.profileId
                    );
                    const targetProfileName = targetProfileId
                      ? profileNameById.get(targetProfileId)
                      : null;
                    const showAddDetails = !isPresent && expandedPackId === pack.id;

                    return (
                      <article
                        key={pack.id}
                        className={cn(
                          "rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5 transition-[background-color,border-color,box-shadow]",
                          showAddDetails &&
                            "border-foreground/16 bg-background shadow-[0_12px_24px_-24px_rgba(15,23,42,0.28)]"
                        )}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                                    : displayedState === "partial"
                                      ? "bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200"
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

                          <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end sm:gap-2">
                            {isPresent ? (
                              <>
                                {!isComplete ? (
                                  <Button
                                    type="button"
                                    variant="premium"
                                    size="xs"
                                    className="rounded-full"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleImport(
                                        pack,
                                        availability?.profileId ?? targetProfileId
                                      )
                                    }
                                  >
                                    Atualizar
                                  </Button>
                                ) : null}
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
                              <>
                                {showAddDetails ? (
                                  <div className="flex min-w-0 items-center justify-end gap-1.5">
                                    <Select
                                      value={targetProfileId ?? ""}
                                      onValueChange={(profileId) =>
                                        setTargetProfileByPack((current) => ({
                                          ...current,
                                          [pack.id]: profileId,
                                        }))
                                      }
                                    >
                                      <SelectTrigger
                                        size="sm"
                                        className="h-7 w-[8.25rem] rounded-[9px] border-border bg-card px-2.5 text-xs font-semibold shadow-none hover:border-foreground/18 hover:bg-muted sm:w-[9rem]"
                                        aria-label={`Perfil para ${pack.name}`}
                                      >
                                        <SelectValue placeholder="Perfil" />
                                      </SelectTrigger>
                                      <SelectContent align="end">
                                        {profiles.map((profile) => (
                                          <SelectItem key={profile.id} value={profile.id}>
                                            <ProfileIcon
                                              icon={profile.icon}
                                              size={13}
                                              className="shrink-0"
                                            />
                                            <span>{profile.name}</span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      type="button"
                                      variant="premium"
                                      size="icon-xs"
                                      className="rounded-[9px]"
                                      disabled={isBusy || !targetProfileId}
                                      onClick={() => handleImport(pack, targetProfileId)}
                                      aria-label={
                                        targetProfileName
                                          ? `Adicionar calendário ${pack.name} ao perfil ${targetProfileName}`
                                          : `Adicionar calendário ${pack.name}`
                                      }
                                      title={
                                        targetProfileName
                                          ? `Adicionar em ${targetProfileName}`
                                          : "Escolha um perfil"
                                      }
                                    >
                                      {displayedState === "adding" ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <Check className="size-3.5" />
                                      )}
                                      <span className="sr-only">Confirmar</span>
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="premium"
                                    size="xs"
                                    className="rounded-full"
                                    disabled={isBusy}
                                    onClick={() => {
                                      if (isCalendarSubscriptionLimitReached) {
                                        setUpgradeDialogOpen(true);
                                        return;
                                      }
                                      setExpandedPackId(pack.id);
                                    }}
                                  >
                                    <Plus className="size-3.5" />
                                    Adicionar calendário
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <ProUpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        reason="calendar-subscriptions"
        onRequireAuth={onRequireAuth}
      />
    </>
  );
}
