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
      className={`${compact ? "w-full min-h-8 justify-center" : "mb-2 min-h-8 justify-center"} flex flex-wrap items-center gap-1.5 sm:gap-2`}
    >
      {profiles.map((profile) => {
        const selected = selectedSet.has(profile.id);
        return (
          <button
            key={profile.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggleSelectedProfile(profile.id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[0.78rem] font-medium shadow-none transition-all ${MOTION_CLASS} ${
              selected
                ? "border-foreground/10 bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.085] dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/14"
                : "border-border/55 bg-background/70 text-foreground/72 hover:border-border/75 hover:bg-muted/35 hover:text-foreground dark:bg-background/45 dark:text-foreground/70 dark:hover:bg-accent/45"
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
