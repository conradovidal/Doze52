"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { exportUserData } from "@/lib/sync";
import { logDevError, logProdError } from "@/lib/safe-log";

export function UserMenu() {
  const { session, signOut } = useAuth();
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const loggedMissingAvatarRef = useRef<string | null>(null);

  const metadata = session?.user.metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name : undefined;
  const shortName = typeof metadata.name === "string" ? metadata.name : undefined;
  const displayName = fullName || shortName || session?.user.email || "";
  const metadataAvatar =
    (typeof metadata.avatar_url === "string" && metadata.avatar_url) ||
    (typeof metadata.picture === "string" && metadata.picture) ||
    null;
  const avatarUrl = metadataAvatar;
  const fallbackInitial =
    (displayName || session?.user.email || "").trim().charAt(0).toUpperCase() || "?";
  const metadataKeys = Object.keys(session?.user.metadata ?? {});
  const isDebug = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!session) return;
    if (metadataAvatar) return;
    if (loggedMissingAvatarRef.current === session.user.id) return;
    loggedMissingAvatarRef.current = session.user.id;
    console.log(
      Object.keys(session.user.metadata ?? {}),
      session.user.metadata ?? null
    );
  }, [metadataAvatar, session]);

  if (!session) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 overflow-hidden rounded-full p-0">
          {avatarUrl && !brokenAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Perfil"
              className="h-8 w-8 rounded-full border border-neutral-200 object-cover"
              onError={() => setBrokenAvatar(true)}
            />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-neutral-200 text-xs text-neutral-700">
              {fallbackInitial}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 rounded-xl">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-neutral-500">Conectado como</p>
            <p className="truncate text-sm">{displayName}</p>
            <p className="truncate text-xs text-neutral-500">{session.user.email}</p>
          </div>
          {isDebug ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
                Debug
              </p>
              <p className="mt-1 text-[11px] text-neutral-600">
                metadata keys: {metadataKeys.length ? metadataKeys.join(", ") : "(none)"}
              </p>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-white p-2 text-[11px] text-neutral-700">
                {JSON.stringify(session.user.metadata ?? null, null, 2)}
              </pre>
            </div>
          ) : null}
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut()}>
            <LogOut size={14} className="mr-2" />
            Sair
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
