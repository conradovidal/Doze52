"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { CategoryManager } from "@/components/category-manager";
import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { ProfileManager } from "@/components/profile-manager";

export function ProfileBar({ compact = false }: { compact?: boolean }) {
  const profiles = useStore((s) => s.profiles);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const toggleSelectedProfile = useStore((s) => s.toggleSelectedProfile);

  const [managerOpen, setManagerOpen] = React.useState(false);
  const [pendingCategoryProfileId, setPendingCategoryProfileId] = React.useState<
    string | null
  >(null);

  if (profiles.length === 0) {
    return null;
  }

  const selectedSet = new Set(selectedProfileIds);

  return (
    <>
      <div
        className={`${compact ? "w-full justify-center" : "mb-3 justify-center"} flex flex-wrap items-center gap-2`}
      >
        {profiles.map((profile) => {
          const selected = selectedSet.has(profile.id);
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => toggleSelectedProfile(profile.id)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                selected
                  ? "border-neutral-800 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              }`}
            >
              <ProfileIcon icon={profile.icon} size={12} className="shrink-0" />
              {selected ? <Check size={12} /> : null}
              <span>{profile.name}</span>
            </button>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => setManagerOpen(true)}>
          Gerenciar
        </Button>
      </div>

      <ProfileManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        onProfileCreated={(profileId) => {
          setPendingCategoryProfileId(profileId);
        }}
      />
      <CategoryManager
        mode="create"
        open={Boolean(pendingCategoryProfileId)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCategoryProfileId(null);
          }
        }}
        profileId={pendingCategoryProfileId ?? undefined}
      />
    </>
  );
}
