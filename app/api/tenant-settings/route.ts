import { campaignToRow, type TenantSettingsRow } from "@/lib/campaignState";
import { getSupabase } from "@/lib/supabase";
import { resolveTenantId } from "@/lib/tenant";

function client() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("missing-supabase-env");
  }
  return supabase;
}

function tenantIdFrom(request: Request): string {
  const url = new URL(request.url);
  return resolveTenantId(url.searchParams.get("id"));
}

const OPTIONAL_COLUMNS = [
  "theme_config",
  "logo_url",
  "brand_name",
  "category",
  "hero_title",
  "hero_subtitle",
  "admin_password",
  "enabled_games",
] as const;

export async function GET(request: Request) {
  try {
    const id = tenantIdFrom(request);
    const { data, error } = await client()
      .from("tenant_settings")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return Response.json(
        { error: error?.message ?? "not-found" },
        { status: 404 },
      );
    }

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const id = tenantIdFrom(request);
    const settings = await request.json();
    const row = { id, ...campaignToRow(settings) };
    const saved = await writeTenantRow(row as TenantSettingsRow & Record<string, unknown>);
    return Response.json(saved);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}

async function writeTenantRow(
  row: TenantSettingsRow & Record<string, unknown>,
): Promise<TenantSettingsRow> {
  let current: Record<string, unknown> = { ...row };
  let last = await upsertRow(current);
  if (last.data) return last.data as TenantSettingsRow;

  for (;;) {
    const missing = OPTIONAL_COLUMNS.filter(
      (column) =>
        column in current && columnMissing(last.error?.message, column),
    );
    if (missing.length === 0) break;
    current = omitKeys(current, missing);
    last = await upsertRow(current);
    if (last.data) return last.data as TenantSettingsRow;
  }

  throw new Error(last.error?.message ?? "update-failed");
}

async function upsertRow(row: Record<string, unknown>) {
  const supabase = client();
  const id = row.id;
  const { id: _id, ...payload } = row;
  const updated = await supabase
    .from("tenant_settings")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (updated.data) return updated;
  if (updated.error && !isNoRow(updated.error.message)) return updated;

  return supabase
    .from("tenant_settings")
    .upsert({ id, ...payload })
    .select("*")
    .maybeSingle();
}

function omitKeys<T extends Record<string, unknown>>(
  row: T,
  keys: readonly string[],
): Record<string, unknown> {
  const next = { ...row };
  keys.forEach((key) => {
    delete next[key];
  });
  return next;
}

function columnMissing(message: string | undefined, column: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  const name = column.toLowerCase();
  return lower.includes(`'${name}'`) || lower.includes(`"${name}"`);
}

function isNoRow(message: string | undefined): boolean {
  if (!message) return true;
  return /0 rows|no rows|cannot coerce/i.test(message);
}
