"use client";

import * as React from "react";
import { CalendarDays, CircleCheck } from "lucide-react";
import { ProfileBar } from "@/components/profile-bar";
import { CategoryBar } from "@/components/category-bar";
import { HabitEditList } from "@/components/habits/habit-edit-list";
import {
  HABIT_COLORS,
  HabitEditorDialog,
} from "@/components/habits/habit-editor-dialog";
import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import {
  GuidedToolbarNoticeCard,
  type GuidedToolbarNotice,
} from "@/components/onboarding/guided-toolbar-notice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useFeedback } from "@/components/ui/feedback-provider";
import { useHabitsStore } from "@/lib/habits-store";
import { orderActiveHabits } from "@/lib/habits-prototype";
import { useBilling } from "@/lib/use-billing";
import type { AnchorPoint } from "@/lib/types";
import type { ProductDestinationId } from "@/lib/product-navigation";

const ORGANIZE_SECTION_OPTIONS = [
  {
    value: "annual",
    label: (
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="size-3.5" aria-hidden="true" />
        Anual
      </span>
    ),
  },
  {
    value: "habits",
    label: (
      <span className="inline-flex items-center gap-1.5">
        <CircleCheck className="size-3.5" aria-hidden="true" />
        Hábitos
      </span>
    ),
  },
] as const satisfies ReadonlyArray<{
  value: ProductDestinationId;
  label: React.ReactNode;
}>;

type FilterEditPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeDestination?: ProductDestinationId;
  editingProfileId: string | null;
  onEditingProfileChange: (profileId: string) => void;
  onCreateProfile: () => void;
  onEditProfile: (profileId: string) => void;
  onCreateCategory: () => void;
  onEditCategory: (categoryId: string) => void;
  categoryCreateOpen?: boolean;
  highlightedProfileId?: string | null;
  highlightedCategoryId?: string | null;
  highlightedCategoryEffect?: "focus" | "reveal";
  guidedToolbarNotice?: GuidedToolbarNotice | null;
  onDismissGuidedSelection?: () => void;
  onRequireAuth?: (anchorPoint?: AnchorPoint) => void;
};

export function FilterEditPanel({
  open,
  onOpenChange,
  activeDestination = "annual",
  editingProfileId,
  onEditingProfileChange,
  onCreateProfile,
  onEditProfile,
  onCreateCategory,
  onEditCategory,
  categoryCreateOpen = false,
  highlightedProfileId,
  highlightedCategoryId,
  highlightedCategoryEffect,
  guidedToolbarNotice,
  onDismissGuidedSelection,
  onRequireAuth,
}: FilterEditPanelProps) {
  const highlightCreate = guidedToolbarNotice?.target === "calendars";

  const [section, setSection] = React.useState<ProductDestinationId>(
    activeDestination
  );
  React.useEffect(() => {
    if (open) setSection(activeDestination);
  }, [open, activeDestination]);

  const { notify } = useFeedback();
  const { limits, isPro, isLoading: isBillingLoading, error: billingError } =
    useBilling();
  const habits = useHabitsStore((s) => s.habits);
  const selectedHabitId = useHabitsStore((s) => s.selectedHabitId);
  const createHabitInStore = useHabitsStore((s) => s.createHabit);
  const updateHabitInStore = useHabitsStore((s) => s.updateHabit);
  const deleteHabitInStore = useHabitsStore((s) => s.deleteHabit);
  const reorderHabitsInStore = useHabitsStore((s) => s.reorderHabits);
  const toggleHabitVisibilityInStore = useHabitsStore(
    (s) => s.toggleHabitVisibility
  );

  const activeHabits = React.useMemo(() => orderActiveHabits(habits), [habits]);
  const selectedHabit = React.useMemo(
    () => activeHabits.find((habit) => habit.id === selectedHabitId) ?? null,
    [activeHabits, selectedHabitId]
  );

  const [habitDialogOpen, setHabitDialogOpen] = React.useState(false);
  const [editingHabitId, setEditingHabitId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState("");
  const [draftColor, setDraftColor] = React.useState<string>(HABIT_COLORS[0]);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);

  const creationUnavailable = isBillingLoading || Boolean(billingError);
  const reachedHabitLimit = activeHabits.length >= limits.maxHabits;
  const habitCreationDisabled = creationUnavailable || (isPro && reachedHabitLimit);

  const requestCreateHabit = () => {
    if (creationUnavailable) {
      notify({
        tone: "info",
        title: "Plano ainda não confirmado",
        description:
          "Seus hábitos continuam disponíveis. Tente criar novamente em instantes.",
      });
      return;
    }
    if (reachedHabitLimit) {
      if (!isPro) {
        setUpgradeOpen(true);
      } else {
        notify({
          tone: "info",
          title: "Limite de hábitos atingido",
          description: "O plano Pro permite acompanhar até 4 hábitos.",
        });
      }
      return;
    }
    setDraftName("");
    setEditingHabitId(null);
    setDraftColor(HABIT_COLORS[activeHabits.length % HABIT_COLORS.length]);
    setHabitDialogOpen(true);
  };

  const requestEditHabit = (habitId: string) => {
    const habit = habits.find((entry) => entry.id === habitId);
    if (!habit) return;
    setEditingHabitId(habit.id);
    setDraftName(habit.name);
    setDraftColor(habit.color);
    setHabitDialogOpen(true);
  };

  const submitHabit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;

    if (editingHabitId) {
      updateHabitInStore(editingHabitId, { name, color: draftColor });
      setHabitDialogOpen(false);
      setEditingHabitId(null);
      return;
    }
    createHabitInStore({ name, color: draftColor });
    setHabitDialogOpen(false);
  };

  const deleteEditingHabit = () => {
    if (!editingHabitId) return;
    deleteHabitInStore(editingHabitId);
    setHabitDialogOpen(false);
    setEditingHabitId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-filter-edit-panel
        className="flex h-[min(28rem,86dvh)] w-[min(30rem,calc(100vw-3rem))] max-w-[30rem] flex-col overflow-hidden p-0"
      >
        <DialogDescription className="sr-only">
          Gerencie contextos, categorias e hábitos.
        </DialogDescription>
        <div className="flex h-full min-h-0 flex-col">
          <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border px-5 py-4">
            <DialogTitle className="text-base font-semibold">
              Organizar
            </DialogTitle>
            <SegmentedControl
              value={section}
              options={ORGANIZE_SECTION_OPTIONS}
              onValueChange={setSection}
              aria-label="Visão a organizar"
              className="min-w-0 justify-self-center"
            />
            <span aria-hidden="true" />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {section === "annual" ? (
              <>
                <section>
                  <ProfileBar
                    isInlineEditMode
                    editingProfileId={editingProfileId}
                    onEditingProfileChange={onEditingProfileChange}
                    onCreateProfile={onCreateProfile}
                    onEditProfile={onEditProfile}
                    highlightedProfileId={highlightedProfileId}
                  />
                </section>

                <section className="relative mt-6 border-t border-border/55 pt-5">
                  <CategoryBar
                    isInlineEditMode
                    editingProfileId={editingProfileId}
                    onCreateCategory={onCreateCategory}
                    onEditCategory={onEditCategory}
                    highlightedCategoryId={highlightedCategoryId}
                    highlightedCategoryEffect={highlightedCategoryEffect}
                    highlightCreate={highlightCreate}
                  />
                  {highlightCreate && !categoryCreateOpen && onDismissGuidedSelection ? (
                    <GuidedToolbarNoticeCard
                      notice={guidedToolbarNotice!}
                      onClose={onDismissGuidedSelection}
                      placement="viewport"
                      portaled
                      anchorSelector="[data-onboarding-calendar-control]"
                      anchorPlacement="below-center"
                    />
                  ) : null}
                </section>
              </>
            ) : (
              <section>
                <HabitEditList
                  habits={activeHabits}
                  selectedHabit={selectedHabit}
                  creationDisabled={habitCreationDisabled}
                  onSelectHabit={toggleHabitVisibilityInStore}
                  onRequestCreate={requestCreateHabit}
                  onEditHabit={requestEditHabit}
                  onReorderHabits={reorderHabitsInStore}
                />
              </section>
            )}
          </div>
        </div>
      </DialogContent>

      <HabitEditorDialog
        open={habitDialogOpen}
        name={draftName}
        color={draftColor}
        onOpenChange={setHabitDialogOpen}
        onNameChange={setDraftName}
        onColorChange={setDraftColor}
        onSubmit={submitHabit}
        editing={Boolean(editingHabitId)}
        onDelete={editingHabitId ? deleteEditingHabit : undefined}
      />
      <ProUpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        reason="habits"
        onRequireAuth={onRequireAuth}
      />
    </Dialog>
  );
}
