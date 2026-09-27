import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenantId } from "@/lib/tenant";

export function economyClient() {
  return getSupabaseAdmin();
}

export function readTenantId(body: { tenantId?: unknown } | null, request: Request): string {
  const fromBody =
    body && typeof body.tenantId === "string" ? body.tenantId : null;
  const url = new URL(request.url);
  return resolveTenantId(fromBody ?? url.searchParams.get("tenantId"));
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

export async function activeTableLabel(
  tenantId: string,
  deviceId: string,
): Promise<string | null> {
  const { data } = await economyClient()
    .from("table_sessions")
    .select("table_code")
    .eq("tenant_id", tenantId)
    .eq("client_id", deviceId)
    .eq("status", "active")
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const code =
    data && typeof (data as { table_code?: string }).table_code === "string"
      ? (data as { table_code: string }).table_code.trim()
      : "";
  if (!code) return null;
  return /^\d+$/.test(code) ? `Masa #${code}` : `Masa ${code}`;
}
