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
  description?: string;
  tone?: FeedbackTone;
  durationMs?: number;
};

type FeedbackToast = FeedbackInput & {
  id: string;
  tone: FeedbackTone;
};

type FeedbackContextValue = {
  notify: (input: FeedbackInput) => string;
  dismiss: (id: string) => void;
};

const FEEDBACK_DURATION_MS: Record<Exclude<FeedbackTone, "loading">, number> = {
  success: 2200,
  info: 2800,
  error: 4200,
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
    return "border-emerald-200/90 bg-emerald-50/96 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-100";
  }
  if (tone === "error") {
    return "border-rose-200/90 bg-rose-50/96 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-100";
  }
  if (tone === "loading") {
    return "border-border/80 bg-background/96 text-foreground";
  }
  return "border-border/80 bg-background/96 text-foreground";
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<FeedbackToast[]>([]);
  const timersRef = React.useRef(new Map<string, number>());

  const dismiss = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (typeof timer === "number") {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = React.useCallback(
    ({ title, description, tone = "info", durationMs }: FeedbackInput) => {
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextToast: FeedbackToast = {
        id,
        title,
        description,
        tone,
        durationMs,
      };

      setToasts((current) => [...current.filter((toast) => toast.title !== title), nextToast].slice(-4));

      const resolvedDuration =
        typeof durationMs === "number"
          ? durationMs
          : tone === "loading"
            ? 0
            : FEEDBACK_DURATION_MS[tone];

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
    return () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  return (
    <FeedbackContext.Provider value={{ notify, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex justify-center px-4 sm:justify-end sm:px-6"
      >
        <div className="flex w-full max-w-sm flex-col gap-2 sm:w-[22rem]">
          {toasts.map((toast) => {
            const Icon = getToastIcon(toast.tone);
            return (
              <div
                key={toast.id}
                role="status"
                className={cn(
                  "pointer-events-auto flex items-start gap-3 rounded-2xl border px-3.5 py-3 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.42)] backdrop-blur data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
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
                  <p className="text-sm font-medium leading-5">{toast.title}</p>
                  {toast.description ? (
                    <p className="text-xs leading-5 text-current/75">{toast.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-current/60 transition-colors hover:bg-black/5 hover:text-current dark:hover:bg-white/8"
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
