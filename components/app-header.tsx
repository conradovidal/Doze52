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
      <div className="grid grid-cols-[1fr_auto_1fr] items-end">
        <div />
        <div className="flex flex-col items-center gap-1.5">
          <div className="inline-flex w-fit flex-col items-center">
            <div className="inline-flex w-full items-baseline justify-between leading-none">
              <span className="font-sans text-2xl font-semibold tracking-tight text-neutral-900">
                Doze 52
              </span>
              <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
                <SelectTrigger className="relative top-[1px] h-7 min-w-[72px] align-middle border-transparent bg-transparent px-1.5 font-sans text-xl leading-none font-normal text-neutral-700 shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 [&_svg]:ml-1 [&_svg]:opacity-80 [&_svg]:text-neutral-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <CategoryBar compact />
        </div>
        <div className="self-end justify-self-end">
          <div className="flex h-8 min-w-[96px] items-center justify-end">
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
    </header>
  );
}
