import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import { touchGuestTable } from "@/lib/guestSessionServer";
import { sanitizeTenantId } from "@/lib/tenant";

type SessionAction = "touch" | "start" | "end";

function parseAction(value: unknown): SessionAction | null {
  if (value === undefined || value === "touch") return "touch";
  if (value === "start" || value === "end") return value;
  return null;
}

function logSessionError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  console.error("[guest-session] touch failed", {
    code: typeof candidate?.code === "string" ? candidate.code : "unknown",
    message:
      typeof candidate?.message === "string"
        ? candidate.message.slice(0, 500)
        : "Unexpected guest session error",
  });
}

export async function POST(request: Request) {
  const device = await resolveDevice(request);

  try {
    const body = (await request.json()) as {
      tenantId?: unknown;
      action?: unknown;
      nickname?: unknown;
      gameType?: unknown;
    };
    const tenantId =
      typeof body.tenantId === "string"
        ? sanitizeTenantId(body.tenantId)?.toLowerCase() ?? null
        : null;
    const action = parseAction(body.action);
    const gameType =
      typeof body.gameType === "string" ? body.gameType.trim().slice(0, 64) : "";

    if (!tenantId || !action || (action === "start" && !gameType)) {
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
      NextResponse.json({ ok: true, guestId: device.id, table }),
      device.token,
      device.fresh,
    );
  } catch (error) {
    logSessionError(error);
    return applyDeviceCookie(
      NextResponse.json(
        { ok: false, reason: "guest-session-failed" },
        { status: 500 },
      ),
      device.token,
      device.fresh,
    );
  }
}
