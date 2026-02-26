"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { GoogleButton } from "./google-button";

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const {
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    refreshSessionFromClient,
    closeGooglePopupIfOpen,
    isGooglePopupOpen,
  } = useAuth();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pendingGooglePopup, setPendingGooglePopup] = React.useState(false);
  const popupIntervalRef = React.useRef<number | null>(null);
  const popupTimeoutRef = React.useRef<number | null>(null);
  const popupClosedAtRef = React.useRef<number | null>(null);
  const popupMessageReceivedRef = React.useRef<"none" | "success" | "error">(
    "none"
  );
  const popupSettledRef = React.useRef(false);
  const pollingInFlightRef = React.useRef(false);

  const clearPopupTimers = React.useCallback(() => {
    if (popupIntervalRef.current !== null) {
      window.clearInterval(popupIntervalRef.current);
      popupIntervalRef.current = null;
    }
    if (popupTimeoutRef.current !== null) {
      window.clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }
  }, []);

  const finalizeAuthSuccess = React.useCallback(
    async (alreadyRefreshed = false) => {
      if (popupSettledRef.current) return;
      const nextSession = alreadyRefreshed
        ? null
        : await refreshSessionFromClient();
      if (!alreadyRefreshed && !nextSession) {
        return;
      }
      popupSettledRef.current = true;
      if (process.env.NODE_ENV !== "production") {
        console.info("[auth] session refreshed", {
          userId: nextSession?.user.id ?? null,
        });
      }
      clearPopupTimers();
      setPendingGooglePopup(false);
      setError(null);
      router.refresh();
      onOpenChange(false);
    },
    [clearPopupTimers, onOpenChange, refreshSessionFromClient, router]
  );

  const finalizeAuthError = React.useCallback(
    (message: string) => {
      if (popupSettledRef.current) return;
      popupSettledRef.current = true;
      clearPopupTimers();
      setPendingGooglePopup(false);
      setError(message);
    },
    [clearPopupTimers]
  );

  React.useEffect(() => {
    if (!open) {
      setPendingGooglePopup(false);
      popupMessageReceivedRef.current = "none";
      popupSettledRef.current = false;
      pollingInFlightRef.current = false;
      popupClosedAtRef.current = null;
      clearPopupTimers();
      return;
    }
    setError(null);
    setEmail("");
    setPassword("");
  }, [clearPopupTimers, open, mode]);

  React.useEffect(() => {
    if (!open) return;

    const onAuthMessage = (event: MessageEvent) => {
      const data =
        event.data && typeof event.data === "object"
          ? (event.data as { type?: string; error?: string })
          : null;

      const originMatches = event.origin === window.location.origin;
      if (process.env.NODE_ENV !== "production") {
        console.info("[auth] message received", {
          type: data?.type ?? null,
          eventOrigin: event.origin,
          currentOrigin: window.location.origin,
          accepted: originMatches,
        });
      }
      if (!originMatches || !data?.type) return;

      if (data.type === "SUPABASE_AUTH_SUCCESS") {
        popupMessageReceivedRef.current = "success";
        void finalizeAuthSuccess(false);
        return;
      }

      if (data.type === "SUPABASE_AUTH_ERROR") {
        popupMessageReceivedRef.current = "error";
        finalizeAuthError("Falha no login com Google. Tente novamente.");
      }
    };

    window.addEventListener("message", onAuthMessage);
    return () => {
      window.removeEventListener("message", onAuthMessage);
      clearPopupTimers();
      closeGooglePopupIfOpen();
    };
  }, [
    clearPopupTimers,
    closeGooglePopupIfOpen,
    finalizeAuthError,
    finalizeAuthSuccess,
    open,
  ]);

  React.useEffect(() => {
    if (!open || !pendingGooglePopup) return;
    popupSettledRef.current = false;
    popupMessageReceivedRef.current = "none";
    pollingInFlightRef.current = false;
    popupClosedAtRef.current = null;
    clearPopupTimers();

    const timeoutMs = 15000;
    const intervalMs = 500;
    const popupClosedGraceMs = 3000;
    const startedAt = Date.now();

    const runSessionCheck = async (
      reason: "poll" | "popup_closed" | "timeout"
    ) => {
      if (popupSettledRef.current || pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
        const nextSession = await refreshSessionFromClient();
        if (nextSession) {
          if (process.env.NODE_ENV !== "production") {
            console.info("[auth] session refreshed", {
              userId: nextSession.user.id,
            });
          }
          await finalizeAuthSuccess(true);
          return;
        }
        if (reason === "popup_closed") {
          if (popupMessageReceivedRef.current === "success") {
            return;
          }
          const closedAt = popupClosedAtRef.current ?? Date.now();
          const elapsedSinceClose = Date.now() - closedAt;
          if (elapsedSinceClose >= popupClosedGraceMs) {
            finalizeAuthError("Falha no login com Google. Tente novamente.");
            return;
          }
        }
        if (reason === "timeout" || Date.now() - startedAt >= timeoutMs) {
          finalizeAuthError("Falha no login com Google. Tente novamente.");
        }
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    popupIntervalRef.current = window.setInterval(() => {
      if (popupSettledRef.current) return;
      const popupOpen = isGooglePopupOpen();
      if (!popupOpen) {
        if (popupClosedAtRef.current === null) {
          popupClosedAtRef.current = Date.now();
        }
        void runSessionCheck("popup_closed");
        return;
      }
      popupClosedAtRef.current = null;
      void runSessionCheck("poll");
    }, intervalMs);

    popupTimeoutRef.current = window.setTimeout(() => {
      if (popupSettledRef.current) return;
      void runSessionCheck("timeout");
    }, timeoutMs);

    return () => {
      clearPopupTimers();
      pollingInFlightRef.current = false;
      popupClosedAtRef.current = null;
    };
  }, [
    clearPopupTimers,
    finalizeAuthError,
    finalizeAuthSuccess,
    isGooglePopupOpen,
    open,
    pendingGooglePopup,
    refreshSessionFromClient,
  ]);

  const canSubmit = email.trim().length > 0 && password.length >= 6;
  const mapAuthError = (raw: string) => {
    const msg = raw.toLowerCase();
    if (msg.includes("invalid login credentials")) return "Email ou senha invalidos.";
    if (msg.includes("user already registered")) return "Este email ja esta cadastrado.";
    if (msg.includes("supabase nao configurado")) {
      return "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.";
    }
    return raw;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") await signInWithPassword(email, password);
      else await signUpWithPassword(email, password);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? mapAuthError(err.message)
          : "Nao foi possivel autenticar."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      popupMessageReceivedRef.current = "none";
      popupSettledRef.current = false;
      setPendingGooglePopup(true);
    } catch (err) {
      setError(
        err instanceof Error ? mapAuthError(err.message) : "Erro no login com Google."
      );
      setPendingGooglePopup(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? "Entrar" : "Criar conta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                mode === "login"
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                mode === "signup"
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
              onClick={() => setMode("signup")}
            >
              Cadastro
            </button>
          </div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Senha (min. 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <GoogleButton onClick={handleGoogle} disabled={loading} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit || loading} onClick={handleSubmit}>
            {mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
