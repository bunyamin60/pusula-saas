import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

let client: SupabaseClient | null = null;

export const TENANT_SETTINGS_ID = DEFAULT_TENANT_ID;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}
