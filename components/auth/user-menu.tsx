"use client";

import { useState } from "react";
import { Download, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { resetAllProductOnboarding } from "@/lib/onboarding";
import { exportUserData, saveSnapshot } from "@/lib/sync";
import { logDevError, logProdError } from "@/lib/safe-log";
import { useStore } from "@/lib/store";

export function UserMenu() {
  const { notify } = useFeedback();
  const { session, signOut } = useAuth();
  const profiles = useStore((state) => state.profiles);
  const categories = useStore((state) => state.categories);
  const events = useStore((state) => state.events);
  const [open, setOpen] = useState(false);
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
      await saveSnapshot({ profiles, categories, events });
      setOpen(false);
      await signOut();
      notify({
        tone: "info",
        title: "Sessão encerrada",
        description: "Seus dados locais foram preservados antes de sair.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar antes de sair. Tente novamente.";
      logDevError("user-menu.sign-out", { message });
      logProdError("Falha ao salvar dados antes do logout.");
      notify({
        tone: "error",
        title: "Nao foi possivel sair agora",
        description: "Falhou ao salvar seus dados antes do logout.",
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
                  await exportUserData();
                  setOpen(false);
                  notify({
                    tone: "success",
                    title: "Exportação iniciada",
                    description: "Seu arquivo será preparado e baixado em seguida.",
                  });
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : "Falhou ao exportar. Tente novamente.";
                  logDevError("user-menu.export", { message });
                  logProdError("Falha ao exportar dados do usuario.");
                  notify({
                    tone: "error",
                    title: "Falha ao exportar",
                    description: "Tente novamente em instantes.",
                  });
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
              onClick={() => {
                resetAllProductOnboarding();
                setOpen(false);
                notify({
                  tone: "success",
                  title: "Tour reiniciado",
                  description: "As dicas iniciais voltaram a ficar disponíveis.",
                });
              }}
            >
              <Sparkles size={14} className="mr-2" />
              Refazer tour
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-xl"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              <LogOut size={14} className="mr-2" />
              {isSigningOut ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
