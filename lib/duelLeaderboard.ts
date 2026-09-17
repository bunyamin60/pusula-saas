import { getSupabase } from "@/lib/supabase";

export type ArcadeScoreGame = "quiz" | "blockblast";

export type QuizLeaderboardEntry = {
  tenantId: string;
  clientId: string;
  nickname: string;
  avatar: string;
  score: number;
  completedAt: string;
  rank: number;
};

type QuizLeaderboardRow = {
  tenant_id: string;
  client_id: string;
  nickname: string;
  avatar: string;
  score: number;
  completed_at: string;
  rank: number | string;
};

function fromRow(row: QuizLeaderboardRow): QuizLeaderboardEntry {
  return {
    tenantId: row.tenant_id,
    clientId: row.client_id,
    nickname: row.nickname,
    avatar: row.avatar,
    score: row.score,
    completedAt: row.completed_at,
    rank: Number(row.rank),
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(999999, Math.round(score)));
}

export async function fetchQuizLeaderboard(
  tenantId: string,
  clientId?: string,
  gameType: ArcadeScoreGame = "quiz",
): Promise<QuizLeaderboardEntry[]> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return [];
    const withType = await supabase.rpc("get_duel_quiz_leaderboard", {
      p_tenant_id: tenantId,
      p_client_id: clientId ?? null,
      p_game_type: gameType,
    });
    if (!withType.error && Array.isArray(withType.data)) {
      return (withType.data as QuizLeaderboardRow[]).map(fromRow);
    }
    if (gameType !== "quiz") return [];
    const { data, error } = await supabase.rpc("get_duel_quiz_leaderboard", {
      p_tenant_id: tenantId,
      p_client_id: clientId ?? null,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as QuizLeaderboardRow[]).map(fromRow);
  } catch {
    return [];
  }
}

export async function submitQuizScore(input: {
  tenantId: string;
  clientId: string;
  nickname: string;
  avatar: string;
  score: number;
  gameType?: ArcadeScoreGame;
}): Promise<QuizLeaderboardEntry | null> {
  try {
    const supabase = getSupabase();
    if (!supabase || !input.tenantId) return null;
    const payload = {
      p_tenant_id: input.tenantId,
      p_client_id: input.clientId,
      p_nickname: input.nickname.slice(0, 64),
      p_avatar: input.avatar.slice(0, 16) || "•",
      p_score: clampScore(input.score),
      p_game_type: input.gameType ?? "quiz",
    };
    const withType = await supabase.rpc("submit_duel_quiz_score", payload);
    if (!withType.error && Array.isArray(withType.data) && withType.data.length > 0) {
      return fromRow(withType.data[0] as QuizLeaderboardRow);
    }
    if (input.gameType && input.gameType !== "quiz") return null;
    const { data, error } = await supabase.rpc("submit_duel_quiz_score", {
      p_tenant_id: payload.p_tenant_id,
      p_client_id: payload.p_client_id,
      p_nickname: payload.p_nickname,
      p_avatar: payload.p_avatar,
      p_score: Math.min(1600, payload.p_score),
    });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return fromRow(data[0] as QuizLeaderboardRow);
  } catch {
    return null;
  }
}
