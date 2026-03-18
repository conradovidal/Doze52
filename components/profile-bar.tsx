"use client";

import { ProfileIcon } from "@/components/profile-icon";
import { useStore } from "@/lib/store";

const MOTION_CLASS = "duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

type ProfileBarProps = {
  compact?: boolean;
  isGlobalEditMode?: boolean;
  onGlobalEditModeChange?: (enabled: boolean) => void;
};

export function ProfileBar({ compact = false }: ProfileBarProps) {
  const profiles = useStore((s) => s.profiles);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const toggleSelectedProfile = useStore((s) => s.toggleSelectedProfile);

  if (profiles.length === 0) {
    return null;
  }

  const selectedSet = new Set(selectedProfileIds);

  return (
    <div
      className={`${compact ? "w-full min-h-9 justify-center" : "mb-2 min-h-9 justify-center"} flex flex-wrap items-center gap-2`}
    >
      {profiles.map((profile) => {
        const selected = selectedSet.has(profile.id);
        return (
          <button
            key={profile.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggleSelectedProfile(profile.id)}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${MOTION_CLASS} ${
              selected
                ? "border-neutral-900 bg-neutral-900 text-neutral-50 hover:bg-neutral-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                : "border-border/80 bg-background text-foreground/75 hover:bg-muted hover:text-foreground dark:bg-background/70"
            }`}
          >
            <ProfileIcon icon={profile.icon} size={12} className="shrink-0" />
            <span>{profile.name}</span>
          </button>
        );
      })}
    </div>
  );
}
