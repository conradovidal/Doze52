"use client";

import { useState } from "react";
import { Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { exportUserData, saveSnapshot } from "@/lib/sync";
import { logDevError, logProdError } from "@/lib/safe-log";
import { useStore } from "@/lib/store";

export function UserMenu() {
  const { session, signOut } = useAuth();
  const profiles = useStore((state) => state.profiles);
  const categories = useStore((state) => state.categories);
  const events = useStore((state) => state.events);
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const metadata = session?.user.metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name : undefined;
  const shortNameRaw =
    typeof metadata.name === "string" ? metadata.name : undefined;
  const isSyntheticGoogleName = (value: string | undefined) =>
    Boolean(value && /^google_[a-z0-9]+$/i.test(value.trim()));
  const shortName = isSyntheticGoogleName(shortNameRaw)
    ? undefined
    : shortNameRaw;
  const email = session?.user.email ?? "";
  const truncatedEmail =
    email.length > 32 ? `${email.slice(0, 29).trimEnd()}...` : email;
  const displayName = fullName || shortName || truncatedEmail || "";
  const metadataAvatar =
    (typeof metadata.avatar_url === "string" && metadata.avatar_url) ||
    (typeof metadata.picture === "string" && metadata.picture) ||
    null;
  const avatarUrl = metadataAvatar;
  const fallbackInitial =
    (displayName || session?.user.email || "").trim().charAt(0).toUpperCase() || "?";

  if (!session) return null;

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      setSignOutError(null);
      await saveSnapshot({ profiles, categories, events });
      await signOut();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar antes de sair. Tente novamente.";
      logDevError("user-menu.sign-out", { message });
      logProdError("Falha ao salvar dados antes do logout.");
      setSignOutError("Nao foi possivel salvar antes de sair. Tente novamente.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 overflow-hidden rounded-full border-border/80 bg-background p-0 shadow-sm"
        >
          {avatarUrl && !brokenAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Perfil"
              className="h-9 w-9 rounded-full border border-border object-cover"
              onError={() => setBrokenAvatar(true)}
            />
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground">
              {fallbackInitial}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 rounded-2xl border-border/80 p-4">
        <div className="space-y-3.5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Conta
            </p>
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <div className="space-y-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-xl"
              disabled={isExporting}
              onClick={async () => {
                try {
                  setIsExporting(true);
                  setExportError(null);
                  setExportSuccess(null);
                  await exportUserData();
                  setExportSuccess("Exportação iniciada com sucesso.");
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : "Falhou ao exportar. Tente novamente.";
                  logDevError("user-menu.export", { message });
                  logProdError("Falha ao exportar dados do usuario.");
                  setExportError("Falhou ao exportar. Tente novamente.");
                } finally {
                  setIsExporting(false);
                }
              }}
            >
              <Download size={14} className="mr-2" />
              {isExporting ? "Exportando..." : "Exportar dados"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-xl"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              <LogOut size={14} className="mr-2" />
              {isSigningOut ? "Salvando..." : "Sair"}
            </Button>
          </div>
          {exportSuccess ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              {exportSuccess}
            </p>
          ) : null}
          {exportError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {exportError}
            </p>
          ) : null}
          {signOutError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {signOutError}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
