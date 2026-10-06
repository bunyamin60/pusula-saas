import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import {
  isUuid,
  joinGuestTable,
  touchGuestTable,
  type VenueVerificationStatus,
} from "@/lib/guestSessionServer";
import { sanitizeTenantId } from "@/lib/tenant";

function joinStatusCode(reason: VenueVerificationStatus): number {
  if (reason === "location_required") return 428;
  if (reason === "invalid_table") return 404;
  if (reason === "venue_location_unconfigured") return 503;
  if (reason === "inaccurate_location" || reason === "outside_venue") return 403;
  return 400;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Transitional adapter for callers that still post to the legacy URL.
 * A join now accepts only a V2 public_token and never writes legacy tables.
 */
export async function POST(request: Request) {
  const device = await resolveDevice(request);

  try {
    const body = (await request.json()) as {
      tenantId?: unknown;
      action?: unknown;
      tableCode?: unknown;
      gameType?: unknown;
      nickname?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      accuracy?: unknown;
    };
    const tenantId =
      typeof body.tenantId === "string"
        ? sanitizeTenantId(body.tenantId)?.toLowerCase() ?? null
        : null;
    const action =
      body.action === "start" || body.action === "end" ? body.action : "join";

    if (!tenantId) {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "invalid-request" }, { status: 400 }),
        device.token,
        device.fresh,
      );
    }

    if (action === "join") {
      const publicToken =
        typeof body.tableCode === "string" ? body.tableCode.trim() : "";
      if (!isUuid(publicToken)) {
        return applyDeviceCookie(
          NextResponse.json({ ok: false, reason: "invalid-table" }, { status: 404 }),
          device.token,
          device.fresh,
        );
      }

      const result = await joinGuestTable({
        guestId: device.id,
        venueSlug: tenantId,
        publicToken,
        latitude: optionalNumber(body.latitude),
        longitude: optionalNumber(body.longitude),
        accuracy: optionalNumber(body.accuracy),
      });
      if (!result.ok) {
        return applyDeviceCookie(
          NextResponse.json(
            { ok: false, reason: result.status },
            { status: joinStatusCode(result.status) },
          ),
          device.token,
          device.fresh,
        );
      }

      const { table } = result;
      return applyDeviceCookie(
        NextResponse.json({
          ok: true,
          table: {
            session_id: table.sessionId,
            table_code: table.tableId,
            table_label: table.tableName,
          },
        }),
        device.token,
        device.fresh,
      );
    }

    const gameType =
      typeof body.gameType === "string" ? body.gameType.trim().slice(0, 64) : "";
    if (action === "start" && !gameType) {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "invalid-request" }, { status: 400 }),
        device.token,
        device.fresh,
      );
    }

    const table = await touchGuestTable({
      guestId: device.id,
      venueSlug: tenantId,
      action,
      nickname:
        typeof body.nickname === "string" ? body.nickname.trim().slice(0, 32) : null,
      gameType: gameType || null,
    });
    return applyDeviceCookie(
      NextResponse.json({ ok: true, table }),
      device.token,
      device.fresh,
    );
  } catch {
    return applyDeviceCookie(
      NextResponse.json({ ok: false, reason: "guest-session-failed" }, { status: 500 }),
      device.token,
      device.fresh,
    );
  }
}
