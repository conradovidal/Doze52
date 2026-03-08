"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { ProfileManager } from "@/components/profile-manager";

export function ProfileBar({ compact = false }: { compact?: boolean }) {
  const profiles = useStore((s) => s.profiles);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const setSelectedProfiles = useStore((s) => s.setSelectedProfiles);
  const toggleSelectedProfile = useStore((s) => s.toggleSelectedProfile);

  const [managerOpen, setManagerOpen] = React.useState(false);

  if (profiles.length === 0) {
    return null;
  }

  const selectedSet = new Set(selectedProfileIds);
  const allSelected = selectedProfileIds.length === profiles.length;

  return (
    <>
      <div
        className={`${compact ? "w-full justify-start" : "mb-3 justify-start"} flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-background/80 p-2`}
      >
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Perfis
        </span>

        <button
          type="button"
          onClick={() => setSelectedProfiles(profiles.map((profile) => profile.id))}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
            allSelected
              ? "border-neutral-800 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          }`}
        >
          {allSelected ? <Check size={12} /> : null}
          Todos
        </button>

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
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: profile.color }}
              />
              {selected ? <Check size={12} /> : null}
              <span>{profile.name}</span>
            </button>
          );
        })}

        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setManagerOpen(true)}>
            Gerenciar
          </Button>
        </div>
      </div>

      <ProfileManager open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  );
}
