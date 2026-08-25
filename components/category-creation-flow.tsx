"use client";

import * as React from "react";
import { ArrowRight, CalendarDays, Tags } from "lucide-react";
import { CalendarPackLauncher } from "@/components/calendar-packs/calendar-pack-launcher";
import { CategoryManager } from "@/components/category-manager";
import { ProfileIcon } from "@/components/profile-icon";
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
            <DialogDescription>
              {profile
                ? `Escolha o que deseja adicionar ao contexto ${profile.name}.`
                : "Escolha como deseja adicionar uma categoria."}
            </DialogDescription>
          </DialogHeader>

          {profile ? (
            <div className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-border bg-muted/35 px-3 py-2 text-xs font-semibold text-foreground">
              <ProfileIcon icon={profile.icon} size={13} />
              {profile.name}
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="relative h-auto min-h-24 items-start justify-start rounded-xl p-4 pr-10 text-left"
              disabled={!profile}
              onClick={() => setStep("custom")}
            >
              <span className="flex min-w-0 items-start gap-3">
                <Tags className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="block font-semibold">Criar minha categoria</span>
                  <span className="mt-1 block whitespace-normal text-xs font-normal text-muted-foreground">
                    Defina nome e cor para organizar seus próprios eventos.
                  </span>
                </span>
              </span>
              <ArrowRight className="absolute top-4 right-4 size-4 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="relative h-auto min-h-24 items-start justify-start rounded-xl p-4 pr-10 text-left"
              disabled={!profile}
              onClick={chooseCalendarPacks}
            >
              <span className="flex min-w-0 items-start gap-3">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="block font-semibold">Adicionar calendário pronto</span>
                  <span className="mt-1 block whitespace-normal text-xs font-normal text-muted-foreground">
                    Assine ou gerencie calendários disponíveis no Doze 52.
                  </span>
                </span>
              </span>
              <ArrowRight className="absolute top-4 right-4 size-4 text-muted-foreground" />
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
