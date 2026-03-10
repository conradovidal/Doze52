"use client";

import * as React from "react";
import { CategoryBar } from "@/components/category-bar";
import { ProfileBar } from "@/components/profile-bar";
import { UserMenu } from "@/components/auth/user-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AnchorPoint } from "@/lib/types";

type AppHeaderProps = {
  year: number;
  onYearChange: (year: number) => void;
  authLoading: boolean;
  isAuthenticated: boolean;
  onOpenAuthDialog: (anchorPoint?: AnchorPoint) => void;
};

export function AppHeader({
  year,
  onYearChange,
  authLoading,
  isAuthenticated,
  onOpenAuthDialog,
}: AppHeaderProps) {
  const [isGlobalEditMode, setIsGlobalEditMode] = React.useState(false);

  return (
    <header className="mb-2 space-y-1">
      <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-3">
        <div className="justify-self-start">
          <img src="/logo-doze52.svg" alt="doze 52" className="h-8 w-auto md:h-9" />
        </div>
        <div
          className="pointer-events-none hidden h-10 justify-self-center md:col-start-2 md:block"
          aria-hidden="true"
        />
        <div className="min-w-0 w-full justify-self-end md:col-start-3 md:w-auto">
          <div className="flex h-10 flex-wrap items-center justify-end gap-2">
            <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
              <SelectTrigger className="h-10 min-w-[88px] shrink-0 border border-neutral-200 bg-neutral-100 px-1.5 font-sans text-xl leading-none font-normal text-neutral-900 shadow-sm hover:bg-neutral-200 focus-visible:border-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-300 [&_svg]:ml-1 [&_svg]:opacity-80 [&_svg]:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:focus-visible:border-neutral-500 dark:focus-visible:ring-neutral-600 dark:[&_svg]:text-neutral-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center">
              <ThemeToggle />
            </div>
            <div className="flex h-10 items-center justify-end">
              {authLoading ? null : isAuthenticated ? (
                <UserMenu />
              ) : (
                <Button
                  size="sm"
                  className="h-10"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    onOpenAuthDialog({ x: rect.right, y: rect.bottom });
                  }}
                >
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[56rem]">
        <ProfileBar
          compact
          isGlobalEditMode={isGlobalEditMode}
          onGlobalEditModeChange={setIsGlobalEditMode}
        />
      </div>
      <div className="mx-auto w-full max-w-[56rem]">
        <CategoryBar compact isGlobalEditMode={isGlobalEditMode} />
      </div>
    </header>
  );
}
