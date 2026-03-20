import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/**
 * Supabase client — null when env vars are not configured.
 * The share feature gracefully degrades: button hidden, no sync.
 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;
