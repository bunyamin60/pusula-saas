import {
  economyClient,
  readClientId,
  readTenantId,
} from "@/lib/economyServer";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tenantId?: string;
      clientId?: string;
      activityName?: string;
      score?: number | null;
    };
    const tenantId = readTenantId(body, request);
    const clientId = readClientId(body);
    const activityName =
      typeof body.activityName === "string" ? body.activityName.trim() : "";
    if (!clientId || !activityName) {
      return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
    }
    const score =
      typeof body.score === "number" && Number.isFinite(body.score)
        ? Math.max(0, Math.floor(body.score))
        : null;

    // Never accept client-provided XP amount — RPC computes from xp_configs.
    const { data, error } = await economyClient().rpc("award_xp", {
      p_tenant_id: tenantId,
      p_client_id: clientId,
      p_activity_name: activityName,
      p_score: score,
    });

    if (error) {
      return Response.json(
        { ok: false, reason: error.message || "offline" },
        { status: 500 },
      );
    }
    return Response.json(data ?? { ok: false, reason: "offline" });
  } catch (error) {
    return Response.json(
      { ok: false, reason: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
