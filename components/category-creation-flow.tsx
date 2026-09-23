"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Tags } from "lucide-react";
import { CalendarPackLauncher } from "@/components/calendar-packs/calendar-pack-launcher";
import { CategoryManager } from "@/components/category-manager";
import { Button } from "@/components/ui/button";
import { ViewSwap } from "@/components/ui/view-swap";
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

/** Troca Organizar ↔ fluxo sem animar a moldura do modal (só o conteúdo desliza). */
const HANDOFF_NO_MOTION_CLASS =
  "data-[state=open]:animate-none data-[state=closed]:animate-none";

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

  const title =
    step === "custom" ? "Nova categoria" : step === "calendar-packs" ? "Calendários" : "Adicionar categoria";
  const goBack =
    step === "custom" ? returnToChoice : step === "calendar-packs" ? returnFromCalendarPacks : onBack;

  return (
    // Um modal só para o fluxo inteiro: cada passo troca o conteúdo (com o
    // mesmo deslize do Organizar) em vez de fechar um modal e abrir outro,
    // o que fazia a tela piscar entre os passos.
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) return;
        if (step === "calendar-packs") onCalendarClose?.();
        closeFlow();
      }}
    >
      <DialogContent
        showCloseButton={!onBack}
        // Aberto a partir do Organizar (onBack): é a continuação do mesmo
        // painel, com o mesmo recorte — entra e sai sem zoom/fade para a
        // troca parecer só o conteúdo mudando.
        overlayClassName={onBack ? HANDOFF_NO_MOTION_CLASS : undefined}
        className={cn(
          "flex min-h-[min(28rem,80dvh)] max-h-[80dvh] sm:max-h-[80dvh] w-[min(30rem,calc(100vw-3rem))] max-w-[30rem] flex-col gap-0 overflow-hidden p-0",
          onBack && HANDOFF_NO_MOTION_CLASS
        )}
      >
        <DialogHeader className="flex h-16 shrink-0 flex-row items-center gap-2 space-y-0 border-b border-border px-5 text-left">
          {goBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="-ml-1.5"
              aria-label={step === "choice" ? "Voltar para Organizar" : "Voltar para as opções de categoria"}
              onClick={goBack}
            >
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {step === "custom"
              ? "Defina o nome, o contexto e a cor da nova categoria."
              : step === "calendar-packs"
                ? "Adicione calendários prontos ao seu ano."
                : "Escolha o que deseja adicionar."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-5">
          <ViewSwap view={step} depth={step === "choice" ? 0 : 1}>
            {step === "custom" ? (
              <CategoryManager
                embedded
                mode="create"
                open
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) closeFlow();
                }}
                profileId={profileId}
                lockProfile
                onCreated={(categoryId) => {
                  focusCreatedCategory(categoryId);
                  onCreated?.(categoryId);
                  closeFlow();
                }}
                onRequireAuth={onRequireAuth}
                bypassLimits={bypassLimits}
              />
            ) : step === "calendar-packs" ? (
              <CalendarPackLauncher
                embedded
                hideTrigger
                compactList
                controlledOpen
                onControlledOpenChange={(nextOpen) => {
                  if (!nextOpen) closeFlow();
                }}
                fixedTargetProfileId={profileId}
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
            ) : (
              <CategoryCreationChoice
                disabled={!profile}
                guided={guidedCalendarSelection}
                onCustom={() => setStep("custom")}
                onCalendarPacks={chooseCalendarPacks}
              />
            )}
          </ViewSwap>
        </div>
      </DialogContent>
    </Dialog>
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
