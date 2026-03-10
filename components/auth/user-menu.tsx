"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
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
        <Button variant="outline" size="sm" className="h-10 w-10 overflow-hidden rounded-full p-0">
          {avatarUrl && !brokenAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Perfil"
              className="h-10 w-10 rounded-full border border-border object-cover"
              onError={() => setBrokenAvatar(true)}
            />
          ) : (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground">
              {fallbackInitial}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 rounded-xl">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Conectado como</p>
            <p className="truncate text-sm">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOut size={14} className="mr-2" />
            {isSigningOut ? "Salvando..." : "Sair"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={isExporting}
            onClick={async () => {
              try {
                setIsExporting(true);
                setExportError(null);
                await exportUserData();
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
            {isExporting ? "Exportando..." : "Exportar dados"}
          </Button>
          {exportError ? <p className="text-xs text-red-600">{exportError}</p> : null}
          {signOutError ? <p className="text-xs text-red-600">{signOutError}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
