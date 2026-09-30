"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  LoaderCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackTone = "success" | "error" | "info" | "loading";

type FeedbackInput = {
  title: string;
  /** Identifica um aviso que se atualiza no lugar (ex.: "sync"): um novo aviso com a mesma chave substitui o anterior. */
  key?: string;
  description?: string;
  tone?: FeedbackTone;
  durationMs?: number;
  /** Botão de ação no aviso (ex.: Desfazer). Fecha o aviso ao clicar. */
  action?: { label: string; onClick: () => void };
};

type FeedbackToast = FeedbackInput & {
  id: string;
  tone: FeedbackTone;
};

type FeedbackContextValue = {
  notify: (input: FeedbackInput) => string;
  /** Fecha um aviso pelo id devolvido por `notify` ou pela `key` dele. */
  dismiss: (idOrKey: string) => void;
};

// Erro e carregando não somem sozinhos: o erro fica até a pessoa fechar no X,
// o carregando até ser substituído pelo resultado.
const FEEDBACK_DURATION_MS: Record<FeedbackTone, number> = {
  success: 2200,
  info: 2800,
  error: 0,
  loading: 0,
};

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null);

const getToastIcon = (tone: FeedbackTone) => {
  if (tone === "success") return CheckCircle2;
  if (tone === "error") return AlertCircle;
  if (tone === "loading") return LoaderCircle;
  return Info;
};

const getToastClasses = (tone: FeedbackTone) => {
  if (tone === "success") {
    return "border-emerald-200/80 bg-emerald-50/92 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100";
  }
  if (tone === "error") {
    return "border-rose-200/80 bg-rose-50/92 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100";
  }
  if (tone === "loading") {
    return "border-border/80 bg-background/96 text-foreground";
  }
  return "border-border/80 bg-background/96 text-foreground";
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<FeedbackToast[]>([]);
  const [isMobile, setIsMobile] = React.useState(false);
  const timersRef = React.useRef(new Map<string, number>());

  const dismiss = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (typeof timer === "number") {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id && toast.key !== id));
  }, []);

  const notify = React.useCallback(
    ({ title, key, description, tone = "info", durationMs, action }: FeedbackInput) => {
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextToast: FeedbackToast = {
        id,
        title,
        key,
        description,
        tone,
        durationMs,
        action,
      };

      setToasts((current) =>
        [
          ...current.filter((toast) => (key ? toast.key !== key : toast.title !== title)),
          nextToast,
        ].slice(-4)
      );

      const resolvedDuration =
        typeof durationMs === "number" ? durationMs : FEEDBACK_DURATION_MS[tone];

      if (resolvedDuration > 0) {
        const timer = window.setTimeout(() => {
          dismiss(id);
        }, resolvedDuration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    const timers = timersRef.current;

    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  // Erro pesa mais que o resto: no celular, onde só cabe um aviso, ele não é
  // escondido por um aviso mais novo.
  const visibleToasts = isMobile
    ? toasts.some((toast) => toast.tone === "error")
      ? toasts.filter((toast) => toast.tone === "error").slice(-1)
      : toasts.slice(-1)
    : toasts;

  return (
    <FeedbackContext.Provider value={{ notify, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[90] flex justify-center px-3 sm:bottom-4 sm:px-6"
      >
        <div className="flex w-full max-w-[20rem] flex-col gap-2 sm:w-[24rem] sm:max-w-none">
          {visibleToasts.map((toast) => {
            const Icon = getToastIcon(toast.tone);
            return (
              <div
                key={toast.id}
                role={toast.tone === "error" ? "alert" : "status"}
                className={cn(
                  "pointer-events-auto flex items-start gap-2.5 rounded-[1.15rem] border px-3 py-2.5 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.3)] backdrop-blur data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:gap-3 sm:rounded-2xl sm:px-3.5 sm:py-3",
                  getToastClasses(toast.tone)
                )}
              >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      toast.tone === "loading" ? "animate-spin" : ""
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[13px] font-medium leading-5 sm:text-sm">
                    {toast.title}
                  </p>
                  {toast.description ? (
                    <p className="text-[11px] leading-[1.1rem] text-current/75 sm:text-xs sm:leading-5">
                      {toast.description}
                    </p>
                  ) : null}
                </div>
                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismiss(toast.id);
                    }}
                    className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold underline-offset-2 transition-colors hover:bg-black/5 hover:underline dark:hover:bg-white/8"
                  >
                    {toast.action.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-current/55 transition-colors hover:bg-black/5 hover:text-current dark:hover:bg-white/8"
                  aria-label="Fechar aviso"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = React.useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used inside FeedbackProvider");
  }
  return context;
}
