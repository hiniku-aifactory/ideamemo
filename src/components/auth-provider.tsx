"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { MOCK_MODE, MOCK_USER } from "@/lib/mock/data";
import { mockDb } from "@/lib/mock/db";

interface User {
  id: string;
  email?: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string | null;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Supabase未設定時はmockフォールバック
  const useLocalAuth = MOCK_MODE || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  useEffect(() => {
    if (useLocalAuth) {
      const isLoggedIn = localStorage.getItem("mock_logged_in");
      if (isLoggedIn) {
        setUser(MOCK_USER as User);
      }
      setLoading(false);
      return;
    }

    // Real Supabase auth listener
    let ignore = false;
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!ignore) {
        setUser(user as User | null);
        setLoading(false);
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser((session?.user as User) ?? null);
      });
      return () => { subscription.unsubscribe(); };
    })();
    return () => { ignore = true; };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (useLocalAuth) {
      localStorage.setItem("mock_logged_in", "true");
      setUser(MOCK_USER as User);
      const settings = mockDb.userSettings.get("mock-user-001");
      window.location.href = settings?.personas?.length ? "/" : "/onboarding";
      return;
    }
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (useLocalAuth) {
      localStorage.setItem("mock_logged_in", "true");
      setUser(MOCK_USER as User);
      const settings = mockDb.userSettings.get("mock-user-001");
      window.location.href = settings?.personas?.length ? "/" : "/onboarding";
      return {};
    }
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    if (useLocalAuth) {
      localStorage.removeItem("mock_logged_in");
      setUser(null);
      window.location.href = "/login";
      return;
    }
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
