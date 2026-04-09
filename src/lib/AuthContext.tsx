"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type AuthGetSessionResult } from "./supabase";
import type { AuthChangeEvent, User, Session } from "@supabase/supabase-js";
import type { Language } from "@/types/shared";
import { isValidLanguage } from "@/lib/localePreference";
import { isValidIanaTimeZone } from "@/lib/dateUtils";

/** Mirrors `user_profiles` in Supabase; optional name fields if columns exist. */
interface UserProfile {
  id: string;
  employeeId: string | null;
  role: "admin" | "supervisor" | "worker" | "logistic";
  companyId: string | null;
  companyName: string | null;
  /** `user_profiles.custom_role_id` → `roles.id` */
  customRoleId?: string | null;
  /** Full name when `full_name` / `display_name` is present on the row. */
  fullName?: string | null;
  /** Auth email (session). */
  email?: string | null;
  /** Panel MachinPro global (columna `is_superadmin` en Supabase). */
  isSuperadmin?: boolean;
  /** Preferencia de idioma (`user_profiles.locale`). */
  locale?: Language | null;
  /** IANA timezone (`user_profiles.timezone`). */
  timezone?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  /** AH-20: periodic GPS during active shift (default true if column missing). */
  locationSharingEnabled?: boolean;
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

type ProfileSelectRow = {
  id: string;
  employee_id?: string | null;
  role: UserProfile["role"];
  company_id?: string | null;
  companies?: { name: string } | null;
} & Record<string, unknown>;

function mapRowToProfile(data: ProfileSelectRow, email: string | null): UserProfile {
  const row = data;
  const fullName =
    (typeof row.full_name === "string" && row.full_name
      ? row.full_name
      : typeof row.display_name === "string" && row.display_name
        ? row.display_name
        : null) ?? null;
  const superRow = row as { is_superadmin?: boolean };
  const customRoleRaw = row.custom_role_id;
  const customRoleId =
    customRoleRaw != null && String(customRoleRaw).trim() ? String(customRoleRaw).trim() : null;
  const localeRaw = row.locale != null && String(row.locale).trim() ? String(row.locale).trim() : null;
  const locale = isValidLanguage(localeRaw) ? localeRaw : null;
  const tzRaw = row.timezone != null && String(row.timezone).trim() ? String(row.timezone).trim() : null;
  const timezone = tzRaw && isValidIanaTimeZone(tzRaw) ? tzRaw : null;
  const phoneRaw = row.phone;
  const avatarRaw = row.avatar_url;
  const locShareRaw = row.location_sharing_enabled;
  const locationSharingEnabled = locShareRaw !== false;
  const companies = data.companies as { name: string } | null | undefined;
  return {
    id: data.id,
    employeeId: data.employee_id ?? null,
    role: data.role,
    companyId: data.company_id ?? null,
    companyName: companies?.name ?? null,
    customRoleId,
    fullName,
    email,
    isSuperadmin: superRow.is_superadmin === true,
    locale,
    timezone,
    phone: typeof phoneRaw === "string" && phoneRaw.trim() ? phoneRaw.trim() : null,
    avatarUrl: typeof avatarRaw === "string" && avatarRaw.trim() ? avatarRaw.trim() : null,
    locationSharingEnabled,
  };
}

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
      const { data: authUser } = await supabase.auth.getUser();
      const email = authUser?.user?.email ?? null;
      setProfile(mapRowToProfile(data as Parameters<typeof mapRowToProfile>[0], email));
      return;
    }

    const { data: sessWrap } = await supabase.auth.getSession();
    const sess = sessWrap.session;
    const u = sess?.user;
    const token = sess?.access_token;
    const meta = u?.user_metadata as Record<string, unknown> | undefined;
    if (
      u?.id === userId &&
      token &&
      meta?.registration_source === "free" &&
      typeof meta.company_name === "string" &&
      meta.company_name.trim() &&
      typeof meta.full_name === "string" &&
      meta.full_name.trim()
    ) {
      try {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${origin}/api/register-free/provision`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const { data: row2 } = await supabase
            .from("user_profiles")
            .select("*, companies(name)")
            .eq("id", userId)
            .single();
          if (row2) {
            const { data: authUser } = await supabase.auth.getUser();
            const email = authUser?.user?.email ?? null;
            setProfile(mapRowToProfile(row2 as ProfileSelectRow, email));
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }

    setProfile(null);
  };

  const syncSession = async () => {
    const { data } = await supabase.auth.getSession();
    const s = data.session ?? null;
    setSession(s);
    setUser(s?.user ?? null);
    if (s?.user) {
      setProfile(null);
      await fetchProfile(s.user.id);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    void supabase.auth.getSession().then((result: AuthGetSessionResult) => {
      const session = result.data.session;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) void fetchProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setProfile(null);
        void fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log("[AUTH] Intentando login con:", email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("[AUTH] Respuesta:", { data, error });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
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
