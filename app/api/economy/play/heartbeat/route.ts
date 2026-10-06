import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import {
  logEconomyError,
  touchGuestPlaySession,
} from "@/lib/economyV2Server";

export async function POST(request: Request) {
  try {
    const device = await resolveDevice(request);
    const body = (await request.json()) as {
      playing?: boolean;
    };
    const payload = await touchGuestPlaySession({
      guestId: device.id,
      playing: body.playing === true,
    });

    return applyDeviceCookie(
      NextResponse.json(payload),
      device.token,
      device.fresh,
    );
  } catch (error) {
    logEconomyError("play-heartbeat", error);
    return NextResponse.json(
      { ok: false, reason: "play-heartbeat-failed" },
      { status: 500 },
    );
  }
}
