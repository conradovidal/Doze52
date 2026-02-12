"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase";

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  user: {
    id: string;
    email: string;
    provider: "password" | "google";
    avatarUrl?: string;
    metadata?: Record<string, unknown>;
  };
};

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

const toAuthSession = (session: Session): AuthSession => {
  const provider =
    session.user.app_metadata?.provider === "google" ? "google" : "password";

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      provider,
      avatarUrl: session.user.user_metadata?.avatar_url as string | undefined,
      metadata: session.user.user_metadata as Record<string, unknown> | undefined,
    },
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!hasSupabaseEnv) {
      setSession(null);
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setSession(null);
      } else {
        setSession(data.session ? toAuthSession(data.session) : null);
      }
      setLoading(false);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ? toAuthSession(nextSession) : null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    if (!hasSupabaseEnv) {
      throw new Error(
        "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (data.session) setSession(toAuthSession(data.session));
  };

  const signUpWithPassword = async (email: string, password: string) => {
    if (!hasSupabaseEnv) {
      throw new Error(
        "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (data.session) {
      setSession(toAuthSession(data.session));
      return;
    }
    throw new Error("Conta criada. Confirme seu email para continuar.");
  };

  const signInWithGoogle = async () => {
    if (typeof window === "undefined") {
      throw new Error("Google OAuth deve ser iniciado no client.");
    }
    if (!hasSupabaseEnv) {
      throw new Error(
        "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    if (process.env.NODE_ENV !== "production") {
      console.info("[auth] google redirectTo:", redirectTo);
    }
    const runRedirectFallback = async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    };

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data?.url) {
      await runRedirectFallback();
      return;
    }

    const width = 520;
    const height = 700;
    const left = Math.max(window.screenX + (window.outerWidth - width) / 2, 0);
    const top = Math.max(window.screenY + (window.outerHeight - height) / 2, 0);
    const features = [
      `width=${Math.round(width)}`,
      `height=${Math.round(height)}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`,
      "popup=yes",
      "resizable=yes",
      "scrollbars=yes",
      "noopener",
      "noreferrer",
    ].join(",");
    const popup = window.open(data.url, "google_oauth", features);

    if (!popup) {
      await runRedirectFallback();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let checking = false;

      const cleanup = () => {
        window.clearInterval(intervalId);
        window.clearTimeout(timeoutId);
      };

      const finish = (cb: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          if (!popup.closed) popup.close();
        } catch {
          // no-op
        }
        cb();
      };

      const intervalId = window.setInterval(async () => {
        if (settled || checking) return;
        checking = true;
        try {
          if (popup.closed) {
            finish(() => reject(new Error("Login com Google cancelado.")));
            return;
          }

          const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();
          if (sessionError) {
            finish(() => reject(sessionError));
            return;
          }
          if (sessionData.session) {
            finish(() => resolve());
          }
        } finally {
          checking = false;
        }
      }, 600);

      const timeoutId = window.setTimeout(() => {
        finish(() =>
          reject(new Error("Tempo esgotado para concluir login com Google."))
        );
      }, 120_000);
    });
  };

  const signOut = async () => {
    if (!hasSupabaseEnv) {
      setSession(null);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        signInWithPassword,
        signUpWithPassword,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
