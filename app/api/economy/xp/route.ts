import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import { awardGuestXp, logEconomyError } from "@/lib/economyV2Server";

export async function POST(request: Request) {
  try {
    const device = await resolveDevice(request);
    const body = (await request.json()) as {
      activityName?: string;
      score?: number | null;
    };
    const activityName =
      typeof body.activityName === "string" ? body.activityName.trim() : "";
    if (!activityName) {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 }),
        device.token,
        device.fresh,
      );
    }
    const score =
      typeof body.score === "number" && Number.isFinite(body.score)
        ? Math.max(0, Math.floor(body.score))
        : null;

    const data = await awardGuestXp({
      guestId: device.id,
      activityName,
      score,
    });

    return applyDeviceCookie(
      NextResponse.json(data),
      device.token,
      device.fresh,
    );
  } catch (error) {
    logEconomyError("xp-award", error);
    return NextResponse.json(
      { ok: false, reason: "xp-award-failed" },
      { status: 500 },
    );
  }
}
