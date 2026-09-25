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
      tableLabel?: string | null;
    };
    const tenantId = readTenantId(body, request);
    const clientId = readClientId(body);
    if (!clientId) {
      return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
    }
    const tableLabel =
      typeof body.tableLabel === "string" ? body.tableLabel.trim().slice(0, 32) : null;

    const { data, error } = await economyClient().rpc("create_stamp_request", {
      p_tenant_id: tenantId,
      p_client_id: clientId,
      p_table_label: tableLabel,
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
