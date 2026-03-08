"use client";

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
  return (
    <header className="mb-6 space-y-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 md:grid-cols-[auto_1fr_auto] md:gap-4">
        <div className="justify-self-start">
          <img src="/logo-doze52.svg" alt="doze 52" className="h-7 w-auto md:h-[2.6rem]" />
        </div>
        <div className="min-w-0 w-full justify-self-end md:col-start-3 md:w-auto">
          <div className="flex min-h-9 flex-wrap items-center justify-end gap-2">
            <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
              <SelectTrigger className="h-9 min-w-[72px] shrink-0 border border-neutral-200 bg-neutral-100 px-1.5 font-sans text-xl leading-none font-normal text-neutral-900 shadow-sm hover:bg-neutral-200 focus-visible:border-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-300 [&_svg]:ml-1 [&_svg]:opacity-80 [&_svg]:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:focus-visible:border-neutral-500 dark:focus-visible:ring-neutral-600 dark:[&_svg]:text-neutral-400">
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
            <div className="flex min-h-9 items-center justify-end">
              {authLoading ? null : isAuthenticated ? (
                <UserMenu />
              ) : (
                <Button
                  size="sm"
                  className="h-9"
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
      <ProfileBar compact />
      <CategoryBar compact />
    </header>
  );
}
