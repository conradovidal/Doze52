"use client";

import * as React from "react";
import { PencilLine } from "lucide-react";
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
  const utilityIconClass =
    "h-9 w-9 rounded-2xl border-border/65 bg-background/70 text-muted-foreground shadow-none transition-colors hover:border-border/80 hover:bg-muted/45 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";
  const utilityButtonClass =
    "h-9 rounded-2xl border-border/65 bg-background/70 px-3.5 text-sm font-medium text-foreground shadow-none transition-colors hover:border-border/80 hover:bg-muted/45 hover:text-foreground";
  const yearSelectClass =
    "h-9 min-w-[90px] rounded-2xl border-border/70 bg-background/80 px-3.5 text-[0.98rem] font-semibold text-foreground shadow-none hover:border-border/85 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring/60 md:text-[1rem] [&_svg]:opacity-70 [&_svg]:text-muted-foreground";

  return (
    <>
      <header className="mb-4 space-y-3 md:mb-5 md:space-y-3.5">
        <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:items-center md:gap-4">
          <div className="justify-self-start">
            <img src="/logo-doze52.png" alt="doze 52" className="h-8 w-auto md:h-9" />
          </div>

          <div className="min-w-0 justify-self-end">
            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className={`${utilityIconClass} ${
                  organizeOpen ? "border-border/80 bg-muted/65 text-foreground" : ""
                }`}
                onClick={() => setOrganizeOpen(true)}
                aria-label="Editar organizacao de perfis e categorias"
                title="Editar organizacao de perfis e categorias"
              >
                <PencilLine className="h-4 w-4" />
              </Button>

              <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
                <SelectTrigger className={yearSelectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>

              <ThemeToggle />

              <div className="flex h-9 items-center justify-end">
                {authLoading ? null : isAuthenticated ? (
                  <UserMenu />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className={utilityButtonClass}
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

        <div className="mx-auto flex w-full max-w-[58rem] flex-col items-center gap-1.5 border-t border-border/45 pt-2.5 md:gap-2 md:pt-3">
          <ProfileBar compact />
          <CategoryBar compact />
        </div>

        <div className="mx-auto h-px w-full max-w-[58rem] bg-border/45" />
      </header>
      <OrganizeWorkspaceDialog open={organizeOpen} onOpenChange={setOrganizeOpen} />
    </>
  );
}
