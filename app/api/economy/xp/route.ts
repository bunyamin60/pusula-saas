import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import { economyClient, readTenantId } from "@/lib/economyServer";

const SCORE_ACTIVITIES = new Set(["quiz", "blockblast"]);

export async function POST(request: Request) {
  try {
    const device = await resolveDevice(request);
    const body = (await request.json()) as {
      tenantId?: string;
      activityName?: string;
      score?: number | null;
    };
    const tenantId = readTenantId(body, request);
    const activityName =
      typeof body.activityName === "string" ? body.activityName.trim() : "";
    if (!activityName) {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 }),
        device.token,
        device.fresh,
      );
    }
    const score =
      typeof body.score === "number" && Number.isFinite(body.score)
        ? Math.max(0, Math.floor(body.score))
        : null;

    if (SCORE_ACTIVITIES.has(activityName)) {
      const { data: session } = await economyClient()
        .from("play_sessions")
        .select("elapsed_seconds, last_heartbeat_at")
        .eq("tenant_id", tenantId)
        .eq("device_id", device.id)
        .maybeSingle();
      const row = session as {
        elapsed_seconds?: number;
        last_heartbeat_at?: string | null;
      } | null;
      const seen = row?.last_heartbeat_at ? Date.parse(row.last_heartbeat_at) : 0;
      const recent = seen > 0 && Date.now() - seen < 3 * 60_000;
      const played = (row?.elapsed_seconds ?? 0) >= 30;
      if (!recent || !played) {
        return applyDeviceCookie(
          NextResponse.json({
            ok: true,
            granted: 0,
            capped: false,
            reason: "no_play",
            xp_total: 0,
            xp_day_earned: 0,
            daily_cap: 100,
          }),
          device.token,
          device.fresh,
        );
      }
    }

    const { data, error } = await economyClient().rpc("award_xp", {
      p_tenant_id: tenantId,
      p_client_id: device.id,
      p_activity_name: activityName,
      p_score: score,
    });

    if (error) {
      return applyDeviceCookie(
        NextResponse.json(
          { ok: false, reason: error.message || "offline" },
          { status: 500 },
        ),
        device.token,
        device.fresh,
      );
    }
    return applyDeviceCookie(
      NextResponse.json(data ?? { ok: false, reason: "offline" }),
      device.token,
      device.fresh,
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
