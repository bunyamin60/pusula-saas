import { getSupabase } from "@/lib/supabase";

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

export async function fetchQuizLeaderboard(
  tenantId: string,
  clientId?: string,
): Promise<QuizLeaderboardEntry[]> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return [];
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
}): Promise<QuizLeaderboardEntry | null> {
  try {
    const supabase = getSupabase();
    if (!supabase || !input.tenantId) return null;
    const { data, error } = await supabase.rpc("submit_duel_quiz_score", {
      p_tenant_id: input.tenantId,
      p_client_id: input.clientId,
      p_nickname: input.nickname,
      p_avatar: input.avatar,
      p_score: Math.max(0, Math.min(1600, Math.round(input.score))),
    });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return fromRow(data[0] as QuizLeaderboardRow);
  } catch {
    return null;
  }
}
