"use client";

import * as React from "react";
import { Settings2 } from "lucide-react";
import { CategoryBar } from "@/components/category-bar";
import { OrganizeWorkspaceDialog } from "@/components/organize-workspace-dialog";
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
  const [organizeOpen, setOrganizeOpen] = React.useState(false);

  return (
    <>
    <header className="mb-4 space-y-3 md:mb-5 md:space-y-4">
      <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="justify-self-start">
          <img src="/logo-doze52.svg" alt="doze 52" className="h-8 w-auto md:h-9" />
        </div>

        <div className="min-w-0 justify-self-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
              <SelectTrigger className="h-9 min-w-[86px] rounded-full border-border/80 bg-background px-3 text-base font-medium text-foreground shadow-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 md:text-[1.05rem] [&_svg]:opacity-70 [&_svg]:text-muted-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>

            <ThemeToggle />

            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className={`h-9 w-9 rounded-full border-border/80 bg-background text-muted-foreground shadow-sm transition-colors ${
                organizeOpen ? "bg-muted text-foreground" : "hover:bg-muted hover:text-foreground"
              }`}
              onClick={() => setOrganizeOpen(true)}
              aria-label="Organizar perfis e categorias"
              title="Organizar perfis e categorias"
            >
              <Settings2 className="h-4 w-4" />
            </Button>

            <div className="flex h-9 items-center justify-end">
              {authLoading ? null : isAuthenticated ? (
                <UserMenu />
              ) : (
                <Button
                  size="sm"
                  variant="premium"
                  className="h-9 rounded-full px-4"
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

      <div className="mx-auto flex w-full max-w-[56rem] flex-col gap-2.5 md:gap-3">
        <ProfileBar compact />
        <CategoryBar compact />
      </div>

      <div className="mx-auto h-px w-full max-w-[56rem] bg-border/60" />
    </header>
    <OrganizeWorkspaceDialog open={organizeOpen} onOpenChange={setOrganizeOpen} />
    </>
  );
}
