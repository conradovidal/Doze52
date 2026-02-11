"use client";

import * as React from "react";

type StoredUser = {
  id: string;
  email: string;
  password: string;
};

export type AuthSession = {
  user: {
    id: string;
    email: string;
    provider: "password" | "google";
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

const USERS_KEY = "doze52-auth-users";
const SESSION_KEY = "doze52-auth-session";

const AuthContext = React.createContext<AuthContextValue | null>(null);

const uid = () => crypto.randomUUID();

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredUser[];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setSession(readSession());
    setLoading(false);
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = readUsers().find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.password === password
    );
    if (!user) throw new Error("Email ou senha invalidos.");
    const nextSession: AuthSession = {
      user: { id: user.id, email: user.email, provider: "password" },
    };
    writeSession(nextSession);
    setSession(nextSession);
  };

  const signUpWithPassword = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const users = readUsers();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error("Este email ja esta cadastrado.");
    }
    const nextUser: StoredUser = { id: uid(), email: normalizedEmail, password };
    writeUsers([...users, nextUser]);
    const nextSession: AuthSession = {
      user: { id: nextUser.id, email: nextUser.email, provider: "password" },
    };
    writeSession(nextSession);
    setSession(nextSession);
  };

  const signInWithGoogle = async () => {
    const guestEmail = `google_${uid().slice(0, 8)}@gmail.com`;
    const nextSession: AuthSession = {
      user: { id: uid(), email: guestEmail, provider: "google" },
    };
    writeSession(nextSession);
    setSession(nextSession);
  };

  const signOut = async () => {
    writeSession(null);
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
