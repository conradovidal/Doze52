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
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase";
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
    closeGooglePopupIfOpen,
    isGooglePopupOpen,
  } = useAuth();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pendingGooglePopup, setPendingGooglePopup] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setPendingGooglePopup(false);
      return;
    }
    setError(null);
    setEmail("");
    setPassword("");
  }, [open, mode]);

  React.useEffect(() => {
    if (!open) return;

    const onAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data =
        event.data && typeof event.data === "object"
          ? (event.data as { type?: string; error?: string })
          : null;
      if (!data?.type) return;
      if (process.env.NODE_ENV !== "production") {
        console.info("[auth] message", { type: data.type, origin: event.origin });
      }

      if (data.type === "SUPABASE_AUTH_SUCCESS") {
        void (async () => {
          if (hasSupabaseEnv) {
            const supabase = getSupabaseBrowserClient();
            await supabase.auth.getSession();
          }
          setPendingGooglePopup(false);
          router.refresh();
          setError(null);
          onOpenChange(false);
        })();
        return;
      }

      if (data.type === "SUPABASE_AUTH_ERROR") {
        setPendingGooglePopup(false);
        setError("Falha no login com Google. Tente novamente.");
      }
    };

    window.addEventListener("message", onAuthMessage);
    return () => {
      window.removeEventListener("message", onAuthMessage);
      closeGooglePopupIfOpen();
    };
  }, [closeGooglePopupIfOpen, onOpenChange, open, router]);

  React.useEffect(() => {
    if (!open || !pendingGooglePopup || !hasSupabaseEnv) return;
    const supabase = getSupabaseBrowserClient();
    const start = Date.now();
    const timeoutMs = 15000;
    const intervalMs = 500;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      const popupOpen = isGooglePopupOpen();
      if (popupOpen && Date.now() - start < timeoutMs) return;

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setPendingGooglePopup(false);
        setError(null);
        router.refresh();
        onOpenChange(false);
        return;
      }

      if (!popupOpen || Date.now() - start >= timeoutMs) {
        setPendingGooglePopup(false);
        setError("Falha no login com Google. Tente novamente.");
      }
    };

    const timer = window.setInterval(() => {
      void poll();
    }, intervalMs);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [isGooglePopupOpen, onOpenChange, open, pendingGooglePopup, router]);

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
          <div className="flex rounded-lg bg-neutral-100 p-1">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                mode === "login" ? "bg-white font-medium shadow-sm" : "text-neutral-600"
              }`}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                mode === "signup" ? "bg-white font-medium shadow-sm" : "text-neutral-600"
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
