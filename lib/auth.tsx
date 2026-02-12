"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase";
import { getAppBaseUrl } from "@/lib/runtime-url";

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
    if (!hasSupabaseEnv) {
      throw new Error(
        "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${getAppBaseUrl()}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
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
