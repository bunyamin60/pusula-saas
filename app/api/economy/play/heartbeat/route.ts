import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import { activeTableLabel, economyClient, readTenantId } from "@/lib/economyServer";

type PlayPayload = {
  ok?: boolean;
  elapsed_seconds?: number;
  target_seconds?: number;
  unlocked?: boolean;
  coupon_code?: string | null;
};

function targetFromMinutes(minutes: number): number {
  const safe = Number.isFinite(minutes) ? Math.min(45, Math.max(1, Math.round(minutes))) : 20;
  return safe * 60;
}

/** Coupon is created only after the configured play duration is full. */
async function issueIfDurationMet(
  tenantId: string,
  deviceId: string,
  elapsedSeconds: number,
): Promise<PlayPayload | null> {
  const admin = economyClient();
  const { data: settings } = await admin
    .from("tenant_settings")
    .select("countdown_minutes")
    .eq("id", tenantId)
    .maybeSingle();
  const targetSeconds = targetFromMinutes(
    Number((settings as { countdown_minutes?: number } | null)?.countdown_minutes),
  );
  // Heartbeats credit at most 15s and can stop a few seconds short of the bar.
  if (elapsedSeconds < Math.max(1, targetSeconds - 15)) return null;

  const { data: existing } = await admin
    .from("play_sessions")
    .select("coupon_code, elapsed_seconds")
    .eq("tenant_id", tenantId)
    .eq("device_id", deviceId)
    .maybeSingle();
  const row = existing as {
    coupon_code?: string | null;
    elapsed_seconds?: number;
  } | null;
  const elapsed = Math.max(elapsedSeconds, row?.elapsed_seconds ?? 0);
  if (row?.coupon_code) {
    return {
      ok: true,
      elapsed_seconds: elapsed,
      target_seconds: targetSeconds,
      unlocked: true,
      coupon_code: row.coupon_code,
    };
  }

  const tableLabel = await activeTableLabel(tenantId, deviceId);
  let code = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    code = `ARADA-${randomBytes(2).toString("hex").toUpperCase()}`;
    const { error } = await admin.from("reward_coupons").insert({
      tenant_id: tenantId,
      coupon_code: code,
      table_id: tableLabel,
      reward_text: "Sure ikrami",
      status: "ACTIVE",
    });
    if (!error) break;
    console.error("reward coupon insert failed", error.message);
    if (attempt === 2) return null;
  }

  await admin
    .from("play_sessions")
    .update({
      coupon_code: code,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("device_id", deviceId);

  return {
    ok: true,
    elapsed_seconds: elapsed,
    target_seconds: targetSeconds,
    unlocked: true,
    coupon_code: code,
  };
}

export async function POST(request: Request) {
  try {
    const device = await resolveDevice(request);
    const body = (await request.json()) as {
      tenantId?: string;
      playing?: boolean;
    };
    const tenantId = readTenantId(body, request);
    const playing = body.playing === true;

    const { data, error } = await economyClient().rpc("touch_play_session", {
      p_tenant_id: tenantId,
      p_device_id: device.id,
      p_playing: playing,
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

    const payload = (data ?? { ok: false }) as PlayPayload;
    if (!payload.coupon_code) {
      const issued = await issueIfDurationMet(
        tenantId,
        device.id,
        Number(payload.elapsed_seconds) || 0,
      );
      if (issued) {
        return applyDeviceCookie(
          NextResponse.json(issued),
          device.token,
          device.fresh,
        );
      }
    }

    return applyDeviceCookie(
      NextResponse.json(payload),
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
