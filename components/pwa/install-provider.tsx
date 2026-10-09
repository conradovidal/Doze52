"use client";

import * as React from "react";

import { IosInstallDialog } from "@/components/pwa/ios-install-dialog";
import {
  getInstallOption,
  isIosDevice,
  isStandaloneDisplay,
  type InstallOption,
} from "@/lib/pwa/install";

// Evento não padronizado do Chrome/Edge/Android: guarda o prompt de instalação
// para a pessoa disparar quando quiser.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallContextValue = {
  /** Como instalar agora (ou null: já instalado, sem suporte ou iOS sem conta sincronizada). */
  option: InstallOption;
  /** A página informa se há conta logada com tudo sincronizado (condição do iOS). */
  setAccountSynced: (synced: boolean) => void;
  /** Abre o prompt do navegador ou o guia do iOS. */
  install: () => Promise<void>;
};

const InstallContext = React.createContext<InstallContextValue>({
  option: null,
  setAccountSynced: () => undefined,
  install: async () => undefined,
});

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);
  const [accountSynced, setAccountSynced] = React.useState(false);
  const [iosGuideOpen, setIosGuideOpen] = React.useState(false);

  React.useEffect(() => {
    // Lido depois da hidratação, para o HTML do servidor e o do cliente
    // começarem iguais.
    setStandalone(isStandaloneDisplay(window));
    setIsIos(isIosDevice(navigator));

    const onPrompt = (event: Event) => {
      // Segura o mini-banner do Chrome: o convite é nosso, no momento certo.
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const option = getInstallOption({
    standalone,
    installed,
    hasPromptEvent: promptEvent !== null,
    isIos,
    accountSynced,
  });

  const install = React.useCallback(async () => {
    if (promptEvent) {
      // O evento só vale uma vez, qualquer que seja a resposta.
      setPromptEvent(null);
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      return;
    }
    if (isIos) setIosGuideOpen(true);
  }, [isIos, promptEvent]);

  const value = React.useMemo(
    () => ({ option, setAccountSynced, install }),
    [install, option]
  );

  return (
    <InstallContext.Provider value={value}>
      {children}
      <IosInstallDialog open={iosGuideOpen} onOpenChange={setIosGuideOpen} />
    </InstallContext.Provider>
  );
}

export const useInstall = () => React.useContext(InstallContext);
