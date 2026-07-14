"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  Loader2,
  Plus,
  Trash2,
  TreePine,
  Trophy,
} from "lucide-react";
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
  importCalendarPackVariant,
  isCalendarPackVariantInstalled,
  removeCalendarPack,
} from "@/lib/calendar-packs/import";
import type {
  CalendarPack,
  CalendarPackIconId,
} from "@/lib/calendar-packs/types";
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

function RacingHelmetIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 13a8 8 0 0 1 16 0v4H9a5 5 0 0 1-5-4Z" />
      <path d="M12 5v8h8" />
      <path d="M7 13h5" />
      <path d="M9 17v2h8" />
    </svg>
  );
}

function SoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m9.2 9.2 2.8-2 2.8 2-1.1 3.3h-3.4L9.2 9.2Z" />
      <path d="m12 7.2-.9-4M9.2 9.2 5.3 8M10.3 12.5 7.8 16M13.7 12.5l2.5 3.5M14.8 9.2 18.7 8M7.8 16l-.2 3.4M16.2 16l.2 3.4" />
    </svg>
  );
}

function CalendarPackIcon({
  icon,
  className,
}: {
  icon: CalendarPackIconId;
  className?: string;
}) {
  if (icon === "racing-helmet") return <RacingHelmetIcon className={className} />;
  if (icon === "soccer-ball") return <SoccerBallIcon className={className} />;
  if (icon === "trophy") return <Trophy aria-hidden="true" className={className} />;
  if (icon === "tree") return <TreePine aria-hidden="true" className={className} />;
  return <CalendarDays aria-hidden="true" className={className} />;
}

const calendarPackCards = (() => {
  const cards: Array<{ key: string; variants: CalendarPack[] }> = [];
  const groupedPackIds = new Set<string>();

  calendarPacks.forEach((pack) => {
    const variantGroupId = pack.variantGroup?.id;
    if (!variantGroupId) {
      cards.push({ key: pack.id, variants: [pack] });
      return;
    }
    if (groupedPackIds.has(variantGroupId)) return;

    groupedPackIds.add(variantGroupId);
    cards.push({
      key: variantGroupId,
      variants: calendarPacks.filter(
        (candidate) => candidate.variantGroup?.id === variantGroupId
      ),
    });
  });

  return cards;
})();

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
  const [selectedVariantByGroup, setSelectedVariantByGroup] = React.useState<
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
      calendarPackCards.filter(({ variants }) => {
        const isPresent = variants.some((pack) => {
          const availability = availabilityByPack.get(pack.id);
          return availability?.hasAnyCategory || availability?.hasImportedEvents;
        });
        const pack =
          variants.find((candidate) =>
            isCalendarPackVariantInstalled(snapshot, candidate, variants)
          ) ?? variants[0];
        const availability = availabilityByPack.get(pack.id);
        if (!availability) return false;
        const isComplete =
          availability.importedEventCount >= availability.totalEventCount &&
          !availability.hasMismatchedEvents;
        return isPresent && !isComplete;
      }).length,
    [availabilityByPack, snapshot]
  );
  const hasPackUpdates = packUpdateCount > 0;
  const subscribedPackCount = React.useMemo(
    () =>
      calendarPackCards.filter(({ variants }) => {
        return variants.some((pack) => {
          const availability = availabilityByPack.get(pack.id);
          return availability?.hasAnyCategory || availability?.hasImportedEvents;
        });
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
    (
      pack: CalendarPack,
      variants: readonly CalendarPack[],
      targetProfileId: string | null
    ) => {
      const isPresent = variants.some((variant) => {
        const availability = availabilityByPack.get(variant.id);
        return availability?.hasAnyCategory || availability?.hasImportedEvents;
      });

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
        const result = importCalendarPackVariant(
          snapshot,
          pack,
          variants,
          "all",
          targetProfileId
        );
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
    (pack: CalendarPack, variants: readonly CalendarPack[]) => {
      setPackFlow(pack.id, "removing");

      try {
        const result = removeCalendarPack(snapshot, pack, variants);
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
        <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:max-w-[600px] sm:p-6">
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
            {calendarPackCards.map(({ key, variants }) => {
              const selectedPackId = selectedVariantByGroup[key];
              const selectedVariant = variants.find(
                (candidate) => candidate.id === selectedPackId
              );
              const groupIsPresent = variants.some((candidate) => {
                const candidateAvailability = availabilityByPack.get(candidate.id);
                return (
                  Boolean(candidateAvailability?.hasAnyCategory) ||
                  Boolean(candidateAvailability?.hasImportedEvents)
                );
              });
              const installedVariant =
                variants.find((candidate) =>
                  isCalendarPackVariantInstalled(snapshot, candidate, variants)
                ) ?? (groupIsPresent ? selectedVariant ?? variants[0] : undefined);
              const pack =
                selectedVariant ??
                installedVariant ??
                variants[0];
              const availability = availabilityByPack.get(pack.id);
              const importedEventCount = availability?.importedEventCount ?? 0;
              const totalEventCount =
                availability?.totalEventCount ?? pack.events.length;
              const isComplete =
                importedEventCount >= totalEventCount &&
                !availability?.hasMismatchedEvents;
              const isPresent = groupIsPresent;
              const currentFlow = flowByPack[pack.id] ?? "idle";
              const isBusy =
                currentFlow === "adding" || currentFlow === "removing";
              const isSwitchingVariant = Boolean(
                installedVariant && installedVariant.id !== pack.id
              );
              const needsUpdate = isPresent && (!isComplete || isSwitchingVariant);
              const targetProfileId = getTargetProfileId(
                pack.id,
                availability?.profileId ??
                  (installedVariant
                    ? availabilityByPack.get(installedVariant.id)?.profileId
                    : null)
              );
              const targetProfileName = targetProfileId
                ? profileNameById.get(targetProfileId)
                : null;
              const showAddDetails = !isPresent && expandedPackId === pack.id;
              const variantGroup = pack.variantGroup;

              return (
                <article
                  key={key}
                  className={cn(
                    "rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5 transition-[background-color,border-color,box-shadow]",
                    showAddDetails &&
                      "border-foreground/16 bg-background shadow-[0_12px_24px_-24px_rgba(15,23,42,0.28)]"
                  )}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5">
                      <CalendarPackIcon
                        icon={pack.icon}
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-foreground">
                          {pack.name}
                        </h4>
                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                          {pack.description}
                        </p>
                        {variantGroup && variants.length > 1 ? (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {variantGroup.label}
                            </span>
                            <Select
                              value={pack.id}
                              onValueChange={(packId) => {
                                setSelectedVariantByGroup((current) => ({
                                  ...current,
                                  [key]: packId,
                                }));
                                setExpandedPackId(null);
                              }}
                            >
                              <SelectTrigger
                                size="sm"
                                className="h-7 w-[11.5rem] rounded-[8px] border-border bg-card px-2.5 text-xs shadow-none hover:border-foreground/18 hover:bg-muted"
                                aria-label={`${variantGroup.label} para ${pack.name}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent align="start">
                                {variants.map((variant) => (
                                  <SelectItem key={variant.id} value={variant.id}>
                                    {variant.variantGroup?.optionLabel}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2">
                      {isPresent ? (
                        <>
                          {needsUpdate ? (
                            <Button
                              type="button"
                              variant="premium"
                              size="xs"
                              className="rounded-full"
                              disabled={isBusy}
                              onClick={() =>
                                handleImport(
                                  pack,
                                  variants,
                                  availability?.profileId ?? targetProfileId
                                )
                              }
                            >
                              {currentFlow === "adding" ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : null}
                              {isSwitchingVariant
                                ? variantGroup?.label === "Estado"
                                  ? "Trocar estado"
                                  : "Trocar time"
                                : "Atualizar"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="dangerSoft"
                            size="xs"
                            className="rounded-full"
                            disabled={isBusy}
                            onClick={() => handleRemove(pack, variants)}
                          >
                            {currentFlow === "removing" ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            Remover
                          </Button>
                        </>
                      ) : showAddDetails ? (
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
                            onClick={() =>
                              handleImport(pack, variants, targetProfileId)
                            }
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
                            {currentFlow === "adding" ? (
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
                          <span className="sm:hidden">Adicionar</span>
                          <span className="hidden sm:inline">Adicionar calendário</span>
                        </Button>
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
