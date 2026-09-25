import {
  economyClient,
  readTenantId,
  verifyAdminPassword,
} from "@/lib/economyServer";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tenantId?: string;
      requestId?: string;
      adminPassword?: string;
    };
    const tenantId = readTenantId(body, request);
    const requestId =
      typeof body.requestId === "string" ? body.requestId.trim() : "";
    const adminPassword =
      typeof body.adminPassword === "string" ? body.adminPassword : "";

    if (!requestId) {
      return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
    }
    if (!(await verifyAdminPassword(tenantId, adminPassword))) {
      return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await economyClient().rpc("approve_stamp_request", {
      p_tenant_id: tenantId,
      p_request_id: requestId,
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
