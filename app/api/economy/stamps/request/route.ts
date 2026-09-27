import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import {
  activeTableLabel,
  economyClient,
  readTenantId,
} from "@/lib/economyServer";

export async function POST(request: Request) {
  try {
    const device = await resolveDevice(request);
    const body = (await request.json()) as { tenantId?: string };
    const tenantId = readTenantId(body, request);
    const tableLabel = await activeTableLabel(tenantId, device.id);

    const { data, error } = await economyClient().rpc("create_stamp_request", {
      p_tenant_id: tenantId,
      p_client_id: device.id,
      p_table_label: tableLabel,
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
