"use client";

import * as React from "react";

import { useFeedback } from "@/components/ui/feedback-provider";
import { useInstall } from "@/components/pwa/install-provider";
import {
  readInviteShownAt,
  shouldShowInvite,
  writeInviteShownAt,
} from "@/lib/pwa/install";

const INVITE_DELAY_MS = 4000;

// Convite único e discreto: aparece quando a pessoa já montou algo dela, com o
// onboarding encerrado, e no máximo uma vez a cada 30 dias. A linha "Instalar
// app" do perfil continua lá para quem quiser depois.
export function InstallInvite({ ready }: { ready: boolean }) {
  const { option, install } = useInstall();
  const { notify } = useFeedback();
  const installRef = React.useRef(install);
  React.useEffect(() => {
    installRef.current = install;
  }, [install]);

  React.useEffect(() => {
    if (!ready || !option) return;
    if (!shouldShowInvite(readInviteShownAt(window.localStorage), Date.now())) return;

    const timer = window.setTimeout(() => {
      // Registrado ao mostrar, não ao responder: aceitar, fechar ou ignorar
      // contam igual, e o aviso não volta antes do intervalo.
      writeInviteShownAt(window.localStorage, Date.now());
      notify({
        key: "install-invite",
        tone: "info",
        title: "Instale o Doze 52",
        description:
          option === "prompt"
            ? "Tenha o Doze 52 na tela inicial, como um app."
            : "Adicione à tela de início e abra como um app.",
        durationMs: 0,
        action: {
          label: option === "prompt" ? "Instalar" : "Ver como",
          onClick: () => void installRef.current(),
        },
      });
    }, INVITE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [notify, option, ready]);

  return null;
}
