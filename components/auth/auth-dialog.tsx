"use client";

import * as React from "react";
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
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setEmail("");
    setPassword("");
  }, [open, mode]);

  const canSubmit = email.trim().length > 0 && password.length >= 6;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") await signInWithPassword(email, password);
      else await signUpWithPassword(email, password);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel autenticar.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no login com Google.");
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
