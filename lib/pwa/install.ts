// Regras do convite de instalação, sem React: assim dá para testar sozinhas.

export const INSTALL_INVITE_STORAGE_KEY = "doze52:install-invite:v1";
// O convite aparece no máximo uma vez neste intervalo, tenha a pessoa
// aceitado, fechado ou ignorado: insistir em "instale o app" cansa.
export const INSTALL_INVITE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

type StandaloneWindow = {
  matchMedia?: (query: string) => { matches: boolean };
  // `standalone` só existe no Safari do iOS e não está nos tipos do DOM.
  navigator?: object;
  document?: { referrer?: string };
};

/**
 * Já está rodando como app instalado? `display-mode` cobre Chrome/Edge (PWA e
 * TWA), `navigator.standalone` cobre o iOS e o referrer `android-app://` cobre
 * o TWA aberto pela Play Store.
 */
export const isStandaloneDisplay = (win: StandaloneWindow) => {
  if (win.matchMedia?.("(display-mode: standalone)").matches) return true;
  if (win.matchMedia?.("(display-mode: fullscreen)").matches) return true;
  if ((win.navigator as { standalone?: boolean } | undefined)?.standalone === true) return true;
  return Boolean(win.document?.referrer?.startsWith("android-app://"));
};

type IosNavigator = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
};

/** iPhone, iPod e iPad (o iPadOS se apresenta como Mac, mas tem toque). */
export const isIosDevice = (nav: IosNavigator) => {
  const userAgent = nav.userAgent ?? "";
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
};

export const readInviteShownAt = (storage: Pick<Storage, "getItem">) => {
  try {
    const raw = storage.getItem(INSTALL_INVITE_STORAGE_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

export const writeInviteShownAt = (
  storage: Pick<Storage, "setItem">,
  now: number
) => {
  try {
    storage.setItem(INSTALL_INVITE_STORAGE_KEY, String(now));
  } catch {
    // Sem storage o convite pode voltar na próxima visita; é dispensável.
  }
};

export const shouldShowInvite = (shownAt: number | null, now: number) =>
  shownAt === null || now - shownAt >= INSTALL_INVITE_COOLDOWN_MS;

export type InstallOption = "prompt" | "ios-guide" | null;

/**
 * Como a pessoa pode instalar agora, se puder:
 * - "prompt": o navegador entregou o `beforeinstallprompt` (Chrome/Edge/Android)
 * - "ios-guide": iOS, onde só dá para instruir (Compartilhar → Tela de Início).
 *   O app instalado no iOS tem armazenamento separado do Safari: quem usa sem
 *   conta perderia o que está só neste aparelho. Por isso só oferecemos a quem
 *   está logado e com tudo já sincronizado.
 */
export const getInstallOption = (input: {
  standalone: boolean;
  installed: boolean;
  hasPromptEvent: boolean;
  isIos: boolean;
  accountSynced: boolean;
}): InstallOption => {
  if (input.standalone || input.installed) return null;
  if (input.hasPromptEvent) return "prompt";
  if (input.isIos && input.accountSynced) return "ios-guide";
  return null;
};
