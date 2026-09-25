import { getSupabase } from "@/lib/supabase";
import { resolveTenantId } from "@/lib/tenant";

export function economyClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("missing-supabase-env");
  return supabase;
}

export function readTenantId(body: { tenantId?: unknown } | null, request: Request): string {
  const fromBody =
    body && typeof body.tenantId === "string" ? body.tenantId : null;
  const url = new URL(request.url);
  return resolveTenantId(fromBody ?? url.searchParams.get("tenantId"));
}

export function readClientId(body: { clientId?: unknown } | null): string | null {
  if (!body || typeof body.clientId !== "string") return null;
  const id = body.clientId.trim();
  return id.length >= 8 && id.length <= 80 ? id : null;
}

export async function verifyAdminPassword(
  tenantId: string,
  password: string,
): Promise<boolean> {
  const pin = password.trim();
  if (!pin) return false;
  const { data } = await economyClient()
    .from("tenant_settings")
    .select("admin_password")
    .eq("id", tenantId)
    .maybeSingle();
  const expected =
    data && typeof (data as { admin_password?: string }).admin_password === "string"
      ? (data as { admin_password: string }).admin_password.trim()
      : "";
  if (!expected) return false;
  return expected === pin;
}
