import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import { economyClient, readTenantId } from "@/lib/economyServer";
import { formatTableLabel, normalizeTableCode } from "@/lib/tableSession";

async function joinTable(
  tenantId: string,
  deviceId: string,
  tableCode: string,
  nickname: string | null,
) {
  const code = normalizeTableCode(tableCode);
  if (!code) return { ok: false as const, reason: "invalid" };
  const admin = economyClient();
  const label = formatTableLabel(code);
  const { data: table, error: tableError } = await admin
    .from("tables")
    .upsert(
      {
        tenant_id: tenantId,
        code,
        label,
        is_active: true,
        sort_order: /^\d+$/.test(code) ? Number(code) : 0,
      },
      { onConflict: "tenant_id,code" },
    )
    .select("id, code, label")
    .single();
  if (tableError || !table) {
    return { ok: false as const, reason: tableError?.message || "table" };
  }

  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from("table_sessions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("client_id", deviceId)
    .eq("status", "active")
    .maybeSingle();

  const patch = {
    table_id: table.id,
    table_code: table.code,
    status: "active",
    ended_at: null,
    last_seen_at: now,
    ...(nickname ? { nickname } : {}),
  };

  if (existing?.id) {
    const { error } = await admin.from("table_sessions").update(patch).eq("id", existing.id);
    if (error) return { ok: false as const, reason: error.message };
    return {
      ok: true as const,
      table: {
        session_id: existing.id,
        table_code: table.code,
        table_label: table.label,
      },
    };
  }

  const { data: inserted, error: insertError } = await admin
    .from("table_sessions")
    .insert({
      tenant_id: tenantId,
      client_id: deviceId,
      ...patch,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return { ok: false as const, reason: insertError?.message || "session" };
  }
  return {
    ok: true as const,
    table: {
      session_id: inserted.id,
      table_code: table.code,
      table_label: table.label,
    },
  };
}

export async function POST(request: Request) {
  try {
    const device = await resolveDevice(request);
    const body = (await request.json()) as {
      tenantId?: string;
      action?: string;
      tableCode?: string;
      gameType?: string;
      nickname?: string | null;
    };
    const tenantId = readTenantId(body, request);
    const action = body.action === "start" || body.action === "end" ? body.action : "join";
    const supabase = economyClient();

    if (action === "start") {
      const gameType = typeof body.gameType === "string" ? body.gameType.trim() : "";
      const { error } = await supabase.rpc("start_table_game", {
        p_tenant_id: tenantId,
        p_client_id: device.id,
        p_game_type: gameType,
      });
      return applyDeviceCookie(
        NextResponse.json(error ? { ok: false, reason: error.message } : { ok: true }),
        device.token,
        device.fresh,
      );
    }

    if (action === "end") {
      const { error } = await supabase.rpc("end_table_game", {
        p_tenant_id: tenantId,
        p_client_id: device.id,
      });
      return applyDeviceCookie(
        NextResponse.json(error ? { ok: false, reason: error.message } : { ok: true }),
        device.token,
        device.fresh,
      );
    }

    const tableCode = typeof body.tableCode === "string" ? body.tableCode.trim() : "";
    if (!tableCode) {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 }),
        device.token,
        device.fresh,
      );
    }
    const nickname =
      typeof body.nickname === "string" ? body.nickname.trim().slice(0, 32) : null;
    const joined = await joinTable(tenantId, device.id, tableCode, nickname);
    if (!joined.ok) {
      return applyDeviceCookie(
        NextResponse.json(
          { ok: false, reason: joined.reason },
          { status: joined.reason === "invalid" ? 400 : 500 },
        ),
        device.token,
        device.fresh,
      );
    }
    return applyDeviceCookie(
      NextResponse.json({ ok: true, table: joined.table }),
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
