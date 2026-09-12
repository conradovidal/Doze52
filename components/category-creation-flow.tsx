"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Tags } from "lucide-react";
import { CalendarPackLauncher } from "@/components/calendar-packs/calendar-pack-launcher";
import { CategoryManager } from "@/components/category-manager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CalendarPack } from "@/lib/calendar-packs/types";
import { getCalendarPackGroupId } from "@/lib/calendar-packs/import";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type CategoryCreationStep = "choice" | "custom" | "calendar-packs";

export function CategoryCreationFlow({
  open,
  onOpenChange,
  profileId,
  onCreated,
  onFocusYear,
  onRequireAuth,
  bypassLimits = false,
  guidedCalendarSelection = false,
  onCalendarOpen,
  onCalendarClose,
  onCalendarImported,
  onBack,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId?: string;
  onCreated?: (categoryId: string) => void;
  onFocusYear?: (year: number) => void;
  onRequireAuth?: () => void;
  bypassLimits?: boolean;
  guidedCalendarSelection?: boolean;
  onCalendarOpen?: () => void;
  onCalendarClose?: () => void;
  onCalendarImported?: (pack: CalendarPack) => void;
  onBack?: () => void;
}) {
  const profiles = useStore((state) => state.profiles);
  const [step, setStep] = React.useState<CategoryCreationStep>("choice");
  const profile = profiles.find((candidate) => candidate.id === profileId) ?? null;

  React.useEffect(() => {
    if (!open) setStep("choice");
  }, [open]);

  const closeFlow = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const focusCreatedCategory = React.useCallback(
    (categoryId?: string) => {
      if (!profileId) return;
      const state = useStore.getState();
      state.setSelectedProfiles([profileId]);
      if (categoryId) state.setCategoriesVisibility([categoryId], true);
    },
    [profileId]
  );
  const returnToChoice = React.useCallback(() => setStep("choice"), []);
  const chooseCalendarPacks = React.useCallback(() => {
    setStep("calendar-packs");
    onCalendarOpen?.();
  }, [onCalendarOpen]);
  const returnFromCalendarPacks = React.useCallback(() => {
    setStep("choice");
    onCalendarClose?.();
  }, [onCalendarClose]);

  return (
    <>
      <Dialog
        open={open && step === "choice"}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeFlow();
        }}
      >
        {/* Mesmo recorte do painel Organizar: daqui a pessoa vê o conteúdo do
            painel ser substituído, não um segundo modal por cima do primeiro. */}
        <DialogContent
          showCloseButton={!onBack}
          className="flex h-[min(28rem,86dvh)] w-[min(30rem,calc(100vw-3rem))] max-w-[30rem] flex-col overflow-hidden p-0"
        >
          <DialogHeader className="shrink-0 space-y-0 border-b border-border px-5 py-4 text-left">
            <div className="flex items-center gap-2">
              {onBack ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="-ml-1.5"
                  aria-label="Voltar para Organizar"
                  onClick={onBack}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              ) : null}
              <DialogTitle className="text-base font-semibold">
                Adicionar categoria
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              Escolha o que deseja adicionar.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="grid h-auto min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-xl p-4 text-left"
              disabled={!profile}
              onClick={() => setStep("custom")}
            >
              <Tags className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block whitespace-normal font-semibold leading-5">
                  Criar minha categoria
                </span>
                <span className="mt-1 block whitespace-normal text-xs font-normal leading-4 text-muted-foreground">
                  Defina nome e cor para organizar seus próprios eventos.
                </span>
              </span>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              variant="outline"
              data-onboarding-calendar-choice={
                guidedCalendarSelection ? "true" : undefined
              }
              className={cn(
                "grid h-auto min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-xl p-4 text-left",
                // O card mantém a aparência original (mesmo componente do
                // vizinho) — só a borda fica um pouco mais grossa, para
                // sugerir "é este" sem recorrer a fundo/anel.
                guidedCalendarSelection && "border-2 border-foreground/30"
              )}
              disabled={!profile}
              onClick={chooseCalendarPacks}
            >
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block whitespace-normal font-semibold leading-5">
                  Adicionar calendário pronto
                </span>
                <span className="mt-1 block whitespace-normal text-xs font-normal leading-4 text-muted-foreground">
                  Assine ou gerencie calendários disponíveis no Doze 52.
                </span>
              </span>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CategoryManager
        mode="create"
        open={open && step === "custom"}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeFlow();
        }}
        profileId={profileId}
        lockProfile
        onBack={returnToChoice}
        onCreated={(categoryId) => {
          focusCreatedCategory(categoryId);
          onCreated?.(categoryId);
          closeFlow();
        }}
        onRequireAuth={onRequireAuth}
        bypassLimits={bypassLimits}
      />

      <CalendarPackLauncher
        hideTrigger
        controlledOpen={open && step === "calendar-packs"}
        onControlledOpenChange={(nextOpen) => {
          if (!nextOpen && step === "calendar-packs") closeFlow();
        }}
        fixedTargetProfileId={profileId}
        onBack={returnFromCalendarPacks}
        onFocusYear={onFocusYear}
        onRequireAuth={onRequireAuth}
        bypassLimits={bypassLimits}
        guidedVariantGroupId={
          guidedCalendarSelection ? "holidays-by-state" : undefined
        }
        requireExplicitVariant={guidedCalendarSelection}
        onClose={onCalendarClose}
        onImported={(pack) => {
          const importedCategory = useStore
            .getState()
            .categories.find(
              (category) =>
                category.profileId === profileId &&
                category.calendarPackGroupId === getCalendarPackGroupId(pack)
            );
          focusCreatedCategory(importedCategory?.id);
          onCalendarImported?.(pack);
          closeFlow();
        }}
      />
    </>
  );
}
