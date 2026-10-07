import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type GameKey = "quiz" | "blockblast";

export type GameLeaderboardEntry = {
  playerKey: string;
  nickname: string;
  avatarUrl: string | null;
  rawScore: number;
  submittedAt: string;
  rank: number;
  isCurrent: boolean;
  category: string;
  weekStart: string;
};

export type WeeklyLeagueEntry = {
  playerKey: string;
  nickname: string;
  avatarUrl: string | null;
  leaguePoints: number;
  bestGamePoints: number;
  contributingGames: number;
  firstContributionAt: string;
  rank: number;
  isCurrent: boolean;
  weekStart: string;
};

export type SubmitGameResult = {
  ok: boolean;
  accepted: boolean;
  duplicate?: boolean;
  reason?: string;
  result_id?: string;
  game_key?: string;
  week_start?: string;
  eligible_for_league?: boolean;
  trust_level?: "client_reported" | "server_authoritative";
  reward_eligible?: boolean;
  retry_at?: string;
};

type GameLeaderboardRow = {
  player_key: string;
  nickname: string;
  avatar_url: string | null;
  raw_score: number;
  submitted_at: string;
  rank: number | string;
  is_current: boolean;
  category: string;
  week_start: string;
};

type WeeklyLeagueRow = {
  player_key: string;
  nickname: string;
  avatar_url: string | null;
  league_points: number;
  best_game_points: number;
  contributing_games: number;
  first_contribution_at: string;
  rank: number | string;
  is_current: boolean;
  week_start: string;
};

function objectResult<T>(data: unknown, fallback: T): T {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as T)
    : fallback;
}

export async function submitGameResult(input: {
  guestId: string;
  gameKey: string;
  rawScore: number;
  category: string;
  nickname: string;
  avatarUrl: string | null;
  submissionId: string;
}): Promise<SubmitGameResult> {
  const { data, error } = await getSupabaseAdmin().rpc("submit_game_result", {
    p_guest_id: input.guestId,
    p_game_key: input.gameKey,
    p_raw_score: input.rawScore,
    p_category: input.category,
    p_nickname: input.nickname,
    p_avatar_url: input.avatarUrl,
    p_submission_key: input.submissionId,
  });
  if (error) throw error;

  return objectResult<SubmitGameResult>(data, {
    ok: false,
    accepted: false,
    reason: "invalid_response",
  });
}

export async function getGameLeaderboard(input: {
  guestId: string;
  gameKey: string;
  category?: string | null;
}): Promise<GameLeaderboardEntry[]> {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_guest_game_leaderboard",
    {
      p_guest_id: input.guestId,
      p_game_key: input.gameKey,
      p_category: input.category?.trim() || null,
    },
  );
  if (error) throw error;
  if (!Array.isArray(data)) return [];

  return (data as GameLeaderboardRow[]).map((row) => ({
    playerKey: row.player_key,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    rawScore: row.raw_score,
    submittedAt: row.submitted_at,
    rank: Number(row.rank),
    isCurrent: row.is_current,
    category: row.category,
    weekStart: row.week_start,
  }));
}

export async function getWeeklyLeaderboard(
  guestId: string,
): Promise<WeeklyLeagueEntry[]> {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_guest_weekly_leaderboard",
    { p_guest_id: guestId },
  );
  if (error) throw error;
  if (!Array.isArray(data)) return [];

  return (data as WeeklyLeagueRow[]).map((row) => ({
    playerKey: row.player_key,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    leaguePoints: row.league_points,
    bestGamePoints: row.best_game_points,
    contributingGames: row.contributing_games,
    firstContributionAt: row.first_contribution_at,
    rank: Number(row.rank),
    isCurrent: row.is_current,
    weekStart: row.week_start,
  }));
}

export function logLeaderboardError(scope: string, error: unknown): void {
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  } | null;
  console.error(`[leaderboard:${scope}] request failed`, {
    code: typeof candidate?.code === "string" ? candidate.code : "unknown",
    message:
      typeof candidate?.message === "string"
        ? candidate.message.slice(0, 500)
        : "Unexpected leaderboard error",
    details:
      typeof candidate?.details === "string"
        ? candidate.details.slice(0, 500)
        : undefined,
  });
}
