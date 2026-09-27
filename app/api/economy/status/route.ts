import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import { economyClient, readTenantId } from "@/lib/economyServer";

async function status(request: Request, tenantId: string) {
  const device = await resolveDevice(request);
  try {
    await economyClient().rpc("settle_weekly_leader_stamp", {
      p_tenant_id: tenantId,
    });
  } catch {
    // Week prize waits until the migration is applied.
  }
  const { data, error } = await economyClient().rpc("get_economy_status", {
    p_tenant_id: tenantId,
    p_client_id: device.id,
  });
  if (error) {
    return applyDeviceCookie(
      NextResponse.json({ ok: false, reason: error.message }, { status: 500 }),
      device.token,
      device.fresh,
    );
  }
  return applyDeviceCookie(
    NextResponse.json(data),
    device.token,
    device.fresh,
  );
}

export async function GET(request: Request) {
  try {
    return await status(request, readTenantId(null, request));
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tenantId?: string };
    return await status(request, readTenantId(body, request));
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
