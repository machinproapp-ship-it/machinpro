import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const hint =
    process.env.NODE_ENV !== "production"
      ? " Add them to .env.local (see Vercel → Settings → Environment Variables for production/preview)."
      : " Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the Vercel project (all environments that run `next build` need them so they embed into the client bundle).";
  throw new Error(
    `Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.${hint}`
  );
}

const g = globalThis as typeof globalThis & {
  __machinpro_supabase_browser?: ReturnType<typeof createBrowserClient>;
};

/** One browser client per tab; stable across Fast Refresh. */
export const supabase: ReturnType<typeof createBrowserClient> =
  g.__machinpro_supabase_browser ??
  (g.__machinpro_supabase_browser = createBrowserClient(supabaseUrl, supabaseAnonKey));

export type AuthGetSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
