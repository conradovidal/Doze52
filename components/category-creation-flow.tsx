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

export type CategoryCreationStep = "choice" | "custom" | "calendar-packs";

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
  initialStep = "choice",
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
  /** Abre direto num passo (o Organizar já mostrou a escolha dentro dele). */
  initialStep?: CategoryCreationStep;
}) {
  const profiles = useStore((state) => state.profiles);
  const [step, setStep] = React.useState<CategoryCreationStep>("choice");
  const profile = profiles.find((candidate) => candidate.id === profileId) ?? null;

  React.useLayoutEffect(() => {
    setStep(open ? initialStep : "choice");
    if (open && initialStep === "calendar-packs") onCalendarOpen?.();
    // Só na abertura: onCalendarOpen muda de identidade a cada render do pai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialStep]);

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
    onCalendarClose?.();
    // Veio direto do Organizar: voltar é voltar para ele.
    if (initialStep === "calendar-packs") {
      if (onBack) onBack();
      else closeFlow();
      return;
    }
    setStep("choice");
  }, [closeFlow, initialStep, onBack, onCalendarClose]);

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
            <CategoryCreationChoice
              disabled={!profile}
              guided={guidedCalendarSelection}
              onCustom={() => setStep("custom")}
              onCalendarPacks={chooseCalendarPacks}
            />
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

/** As duas portas de entrada para uma categoria nova (própria ou calendário pronto). */
export function CategoryCreationChoice({
  disabled = false,
  guided = false,
  onCustom,
  onCalendarPacks,
}: {
  disabled?: boolean;
  guided?: boolean;
  onCustom: () => void;
  onCalendarPacks: () => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
    <Button
      type="button"
      variant="outline"
      className="grid h-auto min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-xl p-4 text-left"
      disabled={disabled}
      onClick={onCustom}
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
        guided ? "true" : undefined
      }
      className={cn(
        "grid h-auto min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-xl p-4 text-left",
        // O card mantém a aparência original (mesmo componente do
        // vizinho) — só a borda fica um pouco mais grossa, para
        // sugerir "é este" sem recorrer a fundo/anel.
        guided && "border-2 border-foreground/30"
      )}
      disabled={disabled}
      onClick={onCalendarPacks}
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
  );
}
