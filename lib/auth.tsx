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
  refreshSessionFromClient: () => Promise<AuthSession | null>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  closeGooglePopupIfOpen: () => void;
  isGooglePopupOpen: () => boolean;
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
  const oauthPopupRef = React.useRef<Window | null>(null);

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

  const refreshSessionFromClient = React.useCallback(async () => {
    if (!hasSupabaseEnv) {
      setSession(null);
      return null;
    }
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      setSession(null);
      return null;
    }
    const nextSession = toAuthSession(data.session);
    setSession(nextSession);
    return nextSession;
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
    if (oauthPopupRef.current && !oauthPopupRef.current.closed) {
      oauthPopupRef.current.focus();
      return;
    }

    const origin = window.location.origin;
    const popupRedirectTo = `${origin}/auth/callback/popup`;
    const fallbackRedirectTo = `${origin}/auth/callback`;
    if (process.env.NODE_ENV !== "production") {
      console.info("[oauth] start", {
        origin,
        popupRedirectTo,
        fallbackRedirectTo,
      });
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: popupRedirectTo,
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data?.url) {
      throw new Error("Nao foi possivel iniciar login com popup.");
    }

    if (process.env.NODE_ENV !== "production") {
      const authorizeUrl = new URL(data.url);
      console.info("[oauth] authorize", {
        url: data.url,
        origin,
        popupRedirectTo,
        authorizeUrl: authorizeUrl.origin + authorizeUrl.pathname,
        redirectToInAuthorize: authorizeUrl.searchParams.get("redirect_to"),
        expectedRedirectUri: process.env.NEXT_PUBLIC_SUPABASE_URL
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`
          : null,
      });
    }

    const width = 520;
    const height = 720;
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
      "toolbar=no",
      "menubar=no",
    ].join(",");
    const popup = window.open(data.url, "doze52_oauth", features);

    if (!popup) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[oauth] fallback", { mode: "redirect", origin });
      }
      const { error: redirectError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: fallbackRedirectTo,
          queryParams: { prompt: "select_account" },
        },
      });
      if (redirectError) throw redirectError;
      return;
    }

    oauthPopupRef.current = popup;
  };

  const closeGooglePopupIfOpen = () => {
    if (!oauthPopupRef.current) return;
    if (!oauthPopupRef.current.closed) {
      oauthPopupRef.current.close();
    }
    oauthPopupRef.current = null;
  };

  const isGooglePopupOpen = () =>
    Boolean(oauthPopupRef.current && !oauthPopupRef.current.closed);

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
        refreshSessionFromClient,
        signInWithPassword,
        signUpWithPassword,
        signInWithGoogle,
        closeGooglePopupIfOpen,
        isGooglePopupOpen,
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
