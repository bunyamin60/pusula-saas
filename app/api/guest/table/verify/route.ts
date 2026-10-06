import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import {
  isUuid,
  joinGuestTable,
  reverifyGuestVenue,
  type VenueVerificationStatus,
} from "@/lib/guestSessionServer";
import { sanitizeTenantId } from "@/lib/tenant";

function statusCode(reason: VenueVerificationStatus): number {
  if (reason === "location_required") return 428;
  if (reason === "invalid_table") return 404;
  if (reason === "venue_location_unconfigured") return 503;
  if (reason === "active_session_required") return 409;
  if (reason === "inaccurate_location" || reason === "outside_venue") return 403;
  return 400;
}

const SOFT_VERIFICATION_FAILURES = new Set<VenueVerificationStatus>([
  "venue_location_unconfigured",
  "location_required",
  "invalid_location",
  "inaccurate_location",
  "outside_venue",
]);

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type ParsedLocation =
  | { kind: "missing" }
  | { kind: "invalid" }
  | {
      kind: "valid";
      latitude: number;
      longitude: number;
      accuracy: number;
    };

function parseLocation(body: {
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
}): ParsedLocation {
  const fields = [body.latitude, body.longitude, body.accuracy];
  const providedCount = fields.filter((value) => value !== undefined).length;
  if (providedCount === 0) return { kind: "missing" };
  if (providedCount !== fields.length) return { kind: "invalid" };

  const latitude = optionalNumber(body.latitude);
  const longitude = optionalNumber(body.longitude);
  const accuracy = optionalNumber(body.accuracy);
  if (
    latitude === null ||
    longitude === null ||
    accuracy === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    accuracy < 0
  ) {
    return { kind: "invalid" };
  }

  return { kind: "valid", latitude, longitude, accuracy };
}

export async function POST(request: Request) {
  const device = await resolveDevice(request);

  try {
    const body = (await request.json()) as {
      tenantId?: unknown;
      publicToken?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      accuracy?: unknown;
    };
    const tenantId =
      typeof body.tenantId === "string"
        ? sanitizeTenantId(body.tenantId)?.toLowerCase() ?? null
        : null;
    const publicTokenProvided = body.publicToken !== undefined;
    const publicToken = typeof body.publicToken === "string"
      ? body.publicToken.trim()
      : "";
    const hasPublicToken = publicToken.length > 0;
    const location = parseLocation(body);

    if (!tenantId || (publicTokenProvided && (!hasPublicToken || !isUuid(publicToken)))) {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 }),
        device.token,
        device.fresh,
      );
    }

    if (location.kind === "invalid") {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "invalid_location" }, { status: 400 }),
        device.token,
        device.fresh,
      );
    }

    if (!hasPublicToken && location.kind === "missing") {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "location_required" }, { status: 428 }),
        device.token,
        device.fresh,
      );
    }

    const result = hasPublicToken
      ? await joinGuestTable({
          guestId: device.id,
          venueSlug: tenantId,
          publicToken,
          latitude: location.kind === "valid" ? location.latitude : null,
          longitude: location.kind === "valid" ? location.longitude : null,
          accuracy: location.kind === "valid" ? location.accuracy : null,
        })
      : location.kind === "valid"
        ? await reverifyGuestVenue({
          guestId: device.id,
          venueSlug: tenantId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        })
        : null;

    if (!result) {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "location_required" }, { status: 428 }),
        device.token,
        device.fresh,
      );
    }

    if (!result.ok) {
      if (result.table && SOFT_VERIFICATION_FAILURES.has(result.status)) {
        const payload = {
          ok: result.status !== "location_required",
          guestId: device.id,
          table: result.table,
          ...(result.status === "location_required"
            ? { reason: result.status }
            : { warning: result.status }),
        };
        return applyDeviceCookie(
          NextResponse.json(payload, {
            status: result.status === "location_required" ? 428 : 200,
          }),
          device.token,
          device.fresh,
        );
      }
      return applyDeviceCookie(
        NextResponse.json(
          { ok: false, reason: result.status },
          { status: statusCode(result.status) },
        ),
        device.token,
        device.fresh,
      );
    }

    return applyDeviceCookie(
      NextResponse.json({ ok: true, guestId: device.id, table: result.table }),
      device.token,
      device.fresh,
    );
  } catch {
    return applyDeviceCookie(
      NextResponse.json(
        { ok: false, reason: "verification_failed" },
        { status: 500 },
      ),
      device.token,
      device.fresh,
    );
  }
}
