import {
  economyClient,
  readTenantId,
  verifyAdminPassword,
} from "@/lib/economyServer";

const DEFAULT_ACTIVITIES = [
  { activity_name: "gunun_sorusu", label: "Günün Sorusu", base_xp: 10, multiplier: 0, max_xp_per_action: 10 },
  { activity_name: "quiz", label: "Bilgi Yarışması", base_xp: 0, multiplier: 0.15, max_xp_per_action: 40 },
  { activity_name: "blockblast", label: "Block Blast", base_xp: 0, multiplier: 0.02, max_xp_per_action: 40 },
  { activity_name: "taboo", label: "Tabu", base_xp: 15, multiplier: 0, max_xp_per_action: 15 },
  { activity_name: "whoami", label: "Ben Kimim", base_xp: 15, multiplier: 0, max_xp_per_action: 15 },
  { activity_name: "draw", label: "Çiz & Bil", base_xp: 20, multiplier: 0, max_xp_per_action: 20 },
  { activity_name: "mini_oyun", label: "Mini Oyun", base_xp: 10, multiplier: 0, max_xp_per_action: 10 },
] as const;

export async function GET(request: Request) {
  try {
    const tenantId = readTenantId(null, request);
    const supabase = economyClient();
    let { data, error } = await supabase
      .from("xp_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("activity_name");

    if (error) {
      return Response.json({ ok: false, reason: error.message, configs: [] }, { status: 500 });
    }

    if (!data?.length) {
      await supabase.from("xp_configs").upsert(
        DEFAULT_ACTIVITIES.map((row) => ({
          tenant_id: tenantId,
          ...row,
          enabled: true,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "tenant_id,activity_name" },
      );
      ({ data } = await supabase
        .from("xp_configs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("activity_name"));
    }

    return Response.json({ ok: true, configs: data ?? [] });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : "failed",
        configs: [],
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tenantId?: string;
      adminPassword?: string;
      config?: {
        id: string;
        base_xp?: number;
        multiplier?: number;
        max_xp_per_action?: number;
        enabled?: boolean;
        label?: string;
      };
    };
    const tenantId = readTenantId(body, request);
    const adminPassword =
      typeof body.adminPassword === "string" ? body.adminPassword : "";
    if (!(await verifyAdminPassword(tenantId, adminPassword))) {
      return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }
    const config = body.config;
    if (!config?.id) {
      return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof config.base_xp === "number") {
      patch.base_xp = Math.max(0, Math.min(100, Math.floor(config.base_xp)));
    }
    if (typeof config.multiplier === "number") {
      patch.multiplier = Math.max(0, Math.min(10, config.multiplier));
    }
    if (typeof config.max_xp_per_action === "number") {
      patch.max_xp_per_action = Math.max(
        1,
        Math.min(100, Math.floor(config.max_xp_per_action)),
      );
    }
    if (typeof config.enabled === "boolean") patch.enabled = config.enabled;
    if (typeof config.label === "string") {
      patch.label = config.label.trim().slice(0, 64);
    }

    const { error } = await economyClient()
      .from("xp_configs")
      .update(patch)
      .eq("id", config.id)
      .eq("tenant_id", tenantId);

    if (error) {
      return Response.json({ ok: false, reason: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { ok: false, reason: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
