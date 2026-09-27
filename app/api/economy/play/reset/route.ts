import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import { economyClient, readTenantId } from "@/lib/economyServer";

export async function POST(request: Request) {
  try {
    const device = await resolveDevice(request);
    const body = (await request.json().catch(() => null)) as {
      tenantId?: string;
    } | null;
    const tenantId = readTenantId(body, request);

    const { error } = await economyClient()
      .from("play_sessions")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("device_id", device.id);

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
      NextResponse.json({ ok: true }),
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
