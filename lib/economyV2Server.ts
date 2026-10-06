import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type GuestPlayHeartbeat = {
  ok: boolean;
  reason?: string;
  accrual_allowed: boolean;
  elapsed_seconds: number;
  credited_seconds?: number;
  target_seconds: number;
  unlocked: boolean;
  coupon_code: string | null;
};

export type GuestXpAward = {
  ok: boolean;
  reason?: string;
  accrual_allowed: boolean;
  granted: number;
  computed?: number;
  capped?: boolean;
  xp_total?: number;
  xp_day_earned?: number;
  daily_cap?: number;
  retry_at?: string;
};

function objectResult<T>(data: unknown, fallback: T): T {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as T)
    : fallback;
}

export async function touchGuestPlaySession(input: {
  guestId: string;
  playing: boolean;
}): Promise<GuestPlayHeartbeat> {
  const { data, error } = await getSupabaseAdmin().rpc(
    "touch_guest_play_session",
    {
      p_guest_id: input.guestId,
      p_playing: input.playing,
    },
  );
  if (error) throw error;

  return objectResult<GuestPlayHeartbeat>(data, {
    ok: false,
    reason: "invalid_response",
    accrual_allowed: false,
    elapsed_seconds: 0,
    target_seconds: 1200,
    unlocked: false,
    coupon_code: null,
  });
}

export async function awardGuestXp(input: {
  guestId: string;
  activityName: string;
  score: number | null;
}): Promise<GuestXpAward> {
  const { data, error } = await getSupabaseAdmin().rpc("award_guest_xp", {
    p_guest_id: input.guestId,
    p_activity_name: input.activityName,
    p_score: input.score,
  });
  if (error) throw error;

  return objectResult<GuestXpAward>(data, {
    ok: false,
    reason: "invalid_response",
    accrual_allowed: false,
    granted: 0,
  });
}

export async function resetGuestPlaySessions(guestId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("guest_play_sessions")
    .delete()
    .eq("guest_id", guestId);
  if (error) throw error;
}

export function logEconomyError(scope: string, error: unknown): void {
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  } | null;
  console.error(`[economy:${scope}] request failed`, {
    code: typeof candidate?.code === "string" ? candidate.code : "unknown",
    message:
      typeof candidate?.message === "string"
        ? candidate.message.slice(0, 500)
        : "Unexpected economy error",
    details:
      typeof candidate?.details === "string"
        ? candidate.details.slice(0, 500)
        : undefined,
  });
}
