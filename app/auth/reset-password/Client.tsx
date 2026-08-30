"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/supabase";

export default function ResetPasswordClient() {
  const router = useRouter();
  const { session, loading, updatePassword } = useAuth();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const canSubmit = password.length >= 6 && password === confirmPassword;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
      window.setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível atualizar a senha."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const showExpiredState = hasSupabaseEnv && !loading && !session;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <BrandLogo />
        </div>

        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando...</p>
        ) : done ? (
          <div className="space-y-1.5 text-center">
            <h1 className="text-lg font-semibold text-foreground">Senha atualizada</h1>
            <p className="text-sm text-muted-foreground">
              Redirecionando para o Doze 52...
            </p>
          </div>
        ) : showExpiredState ? (
          <div className="space-y-1.5 text-center">
            <h1 className="text-lg font-semibold text-foreground">Link expirado</h1>
            <p className="text-sm text-muted-foreground">
              Esse link de redefinição não é mais válido. Volte para o Doze 52 e
              solicite um novo pelo menu de conta.
            </p>
            <Button className="mt-4" onClick={() => router.push("/")}>
              Voltar ao início
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 text-center">
              <h1 className="text-lg font-semibold text-foreground">
                Defina uma nova senha
              </h1>
              <p className="text-sm text-muted-foreground">
                Escolha uma senha com pelo menos 6 caracteres.
              </p>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="reset-password"
                className="text-[12px] font-medium text-foreground/70"
              >
                Nova senha
              </label>
              <Input
                id="reset-password"
                type="password"
                placeholder="No mínimo 6 caracteres"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="reset-password-confirm"
                className="text-[12px] font-medium text-foreground/70"
              >
                Confirmar nova senha
              </label>
              <Input
                id="reset-password-confirm"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={!canSubmit || submitting}>
              <KeyRound className="size-4" />
              {submitting ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
