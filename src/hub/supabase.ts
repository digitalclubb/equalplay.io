import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True when the build has Supabase credentials. The anon key is public by
 * design. Row level security is the actual boundary, not secrecy.
 */
export const isConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(
  url ?? "https://unconfigured.supabase.co",
  anonKey ?? "unconfigured",
  {
    auth: {
      // PKCE so the confirmation and recovery links can't be replayed from a
      // referrer log or shoulder-surfed URL.
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
