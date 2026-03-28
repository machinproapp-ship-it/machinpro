import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Solo `SUPABASE_SERVICE_ROLE_KEY` (p. ej. en Vercel → Settings → Environment Variables).
 * Nunca usar `NEXT_PUBLIC_*` para la service role: expondría acceso total a la base.
 */
export function createSupabaseServiceRole(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente Supabase para rutas servidor (preferir SERVICE_ROLE para webhooks / escrituras sin RLS). */
export function createSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
