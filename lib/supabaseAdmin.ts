import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/** Server-only. Never import this from a client component. */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("missing-service-role");
  }
  if (!admin) {
    admin = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return admin;
}
