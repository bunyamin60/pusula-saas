import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import {
  logEconomyError,
  resetGuestPlaySessions,
} from "@/lib/economyV2Server";

export async function POST(request: Request) {
  try {
    const device = await resolveDevice(request);
    await request.json().catch(() => null);
    await resetGuestPlaySessions(device.id);

    return applyDeviceCookie(
      NextResponse.json({ ok: true }),
      device.token,
      device.fresh,
    );
  } catch (error) {
    logEconomyError("play-reset", error);
    return NextResponse.json(
      { ok: false, reason: "play-reset-failed" },
      { status: 500 },
    );
  }
}
