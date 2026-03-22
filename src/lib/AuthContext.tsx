"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

/** Mirrors `user_profiles` in Supabase; optional name fields if columns exist. */
interface UserProfile {
  id: string;
  employeeId: string | null;
  role: "admin" | "supervisor" | "worker" | "logistic";
  companyId: string | null;
  companyName: string | null;
  /** Full name when `full_name` / `display_name` is present on the row. */
  fullName?: string | null;
  /** Auth email (session). */
  email?: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Relee sesión y perfil desde Supabase (p. ej. tras login en LoginScreen). */
  syncSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from("user_profiles")
      .select("*, companies(name)")
      .eq("id", userId)
      .single();
    if (data) {
      const companies = data.companies as { name: string } | null | undefined;
      const row = data as Record<string, unknown>;
      const fullName =
        (typeof row.full_name === "string" && row.full_name
          ? row.full_name
          : typeof row.display_name === "string" && row.display_name
            ? row.display_name
            : null) ?? null;
      const { data: authUser } = await supabase.auth.getUser();
      const email = authUser?.user?.email ?? null;
      setProfile({
        id: data.id,
        employeeId: data.employee_id ?? null,
        role: data.role,
        companyId: data.company_id ?? null,
        companyName: companies?.name ?? null,
        fullName,
        email,
      });
    } else {
      setProfile(null);
    }
  };

  const syncSession = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const s = data.session ?? null;
    setSession(s);
    setUser(s?.user ?? null);
    if (s?.user) await fetchProfile(s.user.id);
    else setProfile(null);
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase no configurado" };
    console.log("[AUTH] Intentando login con:", email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("[AUTH] Respuesta:", { data, error });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signIn, signOut, syncSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

