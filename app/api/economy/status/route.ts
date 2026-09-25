import {
  economyClient,
  readClientId,
  readTenantId,
} from "@/lib/economyServer";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = readTenantId(null, request);
    const clientId = url.searchParams.get("clientId")?.trim() ?? "";
    if (clientId.length < 8) {
      return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
    }
    const { data, error } = await economyClient().rpc("get_economy_status", {
      p_tenant_id: tenantId,
      p_client_id: clientId,
    });
    if (error) {
      return Response.json(
        { ok: false, reason: error.message },
        { status: 500 },
      );
    }
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { ok: false, reason: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tenantId?: string;
      clientId?: string;
    };
    const tenantId = readTenantId(body, request);
    const clientId = readClientId(body);
    if (!clientId) {
      return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
    }
    const { data, error } = await economyClient().rpc("get_economy_status", {
      p_tenant_id: tenantId,
      p_client_id: clientId,
    });
    if (error) {
      return Response.json(
        { ok: false, reason: error.message },
        { status: 500 },
      );
    }
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { ok: false, reason: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
