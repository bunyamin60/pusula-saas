import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import { isGuestAvatarUrl } from "@/lib/guestAvatars";
import { isUuid } from "@/lib/guestSessionServer";
import {
  getGameLeaderboard,
  getWeeklyLeaderboard,
  logLeaderboardError,
  submitGameResult,
} from "@/lib/leaderboardServer";

export async function GET(request: Request) {
  const device = await resolveDevice(request);
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope")?.trim().toLowerCase();
    const entries =
      scope === "weekly"
        ? await getWeeklyLeaderboard(device.id)
        : await getGameLeaderboard({
            guestId: device.id,
            gameKey: url.searchParams.get("gameKey")?.trim() ?? "",
            category: url.searchParams.get("category"),
          });

    return applyDeviceCookie(
      NextResponse.json({ ok: true, entries }),
      device.token,
      device.fresh,
    );
  } catch (error) {
    logLeaderboardError("read", error);
    return applyDeviceCookie(
      NextResponse.json(
        { ok: false, reason: "leaderboard-read-failed", entries: [] },
        { status: 500 },
      ),
      device.token,
      device.fresh,
    );
  }
}

export async function POST(request: Request) {
  const device = await resolveDevice(request);
  try {
    const body = (await request.json()) as {
      gameKey?: unknown;
      rawScore?: unknown;
      category?: unknown;
      nickname?: unknown;
      avatarUrl?: unknown;
      submissionId?: unknown;
    };
    const gameKey =
      typeof body.gameKey === "string" ? body.gameKey.trim().toLowerCase() : "";
    const rawScore =
      typeof body.rawScore === "number" &&
      Number.isFinite(body.rawScore) &&
      Number.isInteger(body.rawScore)
        ? body.rawScore
        : null;
    const suppliedSubmissionId =
      typeof body.submissionId === "string" ? body.submissionId : "";
    const submissionId = isUuid(suppliedSubmissionId)
      ? suppliedSubmissionId
      : crypto.randomUUID();

    if (!gameKey || rawScore === null) {
      return applyDeviceCookie(
        NextResponse.json(
          { ok: false, accepted: false, reason: "invalid_request" },
          { status: 400 },
        ),
        device.token,
        device.fresh,
      );
    }

    const result = await submitGameResult({
      guestId: device.id,
      gameKey,
      rawScore,
      category:
        typeof body.category === "string" ? body.category.trim().toLowerCase() : "",
      nickname:
        typeof body.nickname === "string" ? body.nickname.trim().slice(0, 64) : "",
      avatarUrl:
        typeof body.avatarUrl === "string" && isGuestAvatarUrl(body.avatarUrl)
          ? body.avatarUrl
          : null,
      submissionId,
    });
    const entries = await getGameLeaderboard({
      guestId: device.id,
      gameKey,
      category:
        typeof body.category === "string" ? body.category.trim().toLowerCase() : null,
    });
    const entry = entries.find((candidate) => candidate.isCurrent) ?? null;
    const invalid =
      result.reason === "unknown_game" ||
      result.reason === "server_authoritative_submission_required" ||
      result.reason === "invalid_score" ||
      result.reason === "invalid_category" ||
      result.reason === "invalid_request";

    return applyDeviceCookie(
      NextResponse.json(
        { ...result, entry },
        { status: invalid ? 400 : 200 },
      ),
      device.token,
      device.fresh,
    );
  } catch (error) {
    logLeaderboardError("submit", error);
    return applyDeviceCookie(
      NextResponse.json(
        { ok: false, accepted: false, reason: "leaderboard-submit-failed" },
        { status: 500 },
      ),
      device.token,
      device.fresh,
    );
  }
}
