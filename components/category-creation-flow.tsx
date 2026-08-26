"use client";

import * as React from "react";
import { ArrowRight, CalendarDays, Tags } from "lucide-react";
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
        <DialogContent className="p-5 sm:max-w-[480px] sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle>Adicionar categoria</DialogTitle>
            <DialogDescription>Escolha o que deseja adicionar.</DialogDescription>
          </DialogHeader>

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
              className="grid h-auto min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-xl p-4 text-left"
              disabled={!profile}
              onClick={chooseCalendarPacks}
            >
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                {guidedCalendarSelection ? (
                  <span className="mb-1.5 inline-flex rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-primary-foreground">
                    Clique aqui
                  </span>
                ) : null}
                <span className="block whitespace-normal font-semibold leading-5">
                  Adicionar calendário pronto
                </span>
                <span className="mt-1 block whitespace-normal text-xs font-normal leading-4 text-muted-foreground">
                  Assine ou gerencie calendários disponíveis no{" "}
                  <span className="whitespace-nowrap">Doze 52.</span>
                </span>
              </span>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </Button>
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
