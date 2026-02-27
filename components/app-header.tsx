"use client";

import { CategoryBar } from "@/components/category-bar";
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

type AppHeaderProps = {
  year: number;
  onYearChange: (year: number) => void;
  authLoading: boolean;
  isAuthenticated: boolean;
  onOpenAuthDialog: () => void;
};

export function AppHeader({
  year,
  onYearChange,
  authLoading,
  isAuthenticated,
  onOpenAuthDialog,
}: AppHeaderProps) {
  return (
    <header className="mb-6">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 md:grid-cols-[auto_1fr_auto] md:gap-4">
        <div className="justify-self-start">
          <img src="/logo-doze52.svg" alt="doze 52" className="h-7 w-auto md:h-[2.6rem]" />
        </div>
        <div className="min-w-0 w-full justify-self-end md:col-start-3 md:w-auto">
          <div className="grid min-h-9 grid-cols-[minmax(72px,max-content)_40px_minmax(96px,max-content)] items-center justify-end gap-1.5">
            <div className="justify-self-end">
              <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
                <SelectTrigger className="h-8 min-w-[72px] shrink-0 border-transparent bg-transparent px-1.5 font-sans text-xl leading-none font-normal text-foreground shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 [&_svg]:ml-1 [&_svg]:opacity-80 [&_svg]:text-muted-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center">
              <ThemeToggle />
            </div>
            <div className="flex min-h-9 min-w-[96px] items-center justify-end">
              {authLoading ? null : isAuthenticated ? (
                <UserMenu />
              ) : (
                <Button size="sm" className="h-8" onClick={onOpenAuthDialog}>
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-2 flex w-full justify-start md:col-span-1 md:col-start-2 md:row-start-1 md:justify-center">
          <CategoryBar compact />
        </div>
      </div>
    </header>
  );
}
