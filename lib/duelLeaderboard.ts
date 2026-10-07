import { readCustomerProfile } from "@/lib/customerProfile";
import { isGuestAvatarUrl } from "@/lib/guestAvatars";
import type { QuizCategoryId } from "@/lib/quizBank";

export type ArcadeScoreGame = "quiz" | "blockblast";

export type QuizLeaderboardEntry = {
  tenantId: string;
  clientId: string;
  nickname: string;
  avatar: string;
  score: number;
  completedAt: string;
  rank: number;
  tableId?: string | null;
  avatarUrl?: string | null;
  category?: string | null;
  isCurrent: boolean;
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

type GameLeaderboardApiEntry = {
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

type LeaderboardResponse<T> = {
  ok: boolean;
  accepted?: boolean;
  entries?: T[];
  entry?: T | null;
};

function fromApi(entry: GameLeaderboardApiEntry): QuizLeaderboardEntry {
  return {
    tenantId: "",
    clientId: entry.playerKey,
    nickname: entry.nickname,
    avatar: "",
    score: entry.rawScore,
    completedAt: entry.submittedAt,
    rank: Number(entry.rank),
    tableId: null,
    avatarUrl: isGuestAvatarUrl(entry.avatarUrl) ? entry.avatarUrl : null,
    category: entry.category || null,
    isCurrent: entry.isCurrent,
    weekStart: entry.weekStart,
  };
}

/** Only registered / picked avatars — never invent a default for guests. */
export function resolveScoreAvatarUrl(
  explicit?: string | null,
): string | null {
  if (isGuestAvatarUrl(explicit)) return explicit;
  const profile = readCustomerProfile();
  if (profile?.avatarUrl && isGuestAvatarUrl(profile.avatarUrl)) {
    return profile.avatarUrl;
  }
  return null;
}

export function entryAvatarSrc(
  entry: Pick<QuizLeaderboardEntry, "avatarUrl">,
): string | null {
  return isGuestAvatarUrl(entry.avatarUrl) ? entry.avatarUrl : null;
}

export async function fetchQuizLeaderboard(
  tenantId: string,
  clientId?: string,
  gameType: ArcadeScoreGame = "quiz",
  category?: QuizCategoryId | string | null,
): Promise<QuizLeaderboardEntry[]> {
  void tenantId;
  void clientId;
  try {
    const params = new URLSearchParams({ gameKey: gameType });
    if (category) params.set("category", category.toString().toLowerCase());
    const response = await fetch(`/api/leaderboard?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as LeaderboardResponse<GameLeaderboardApiEntry>;
    return Array.isArray(payload.entries) ? payload.entries.map(fromApi) : [];
  } catch {
    return [];
  }
}

export async function fetchWeeklyLeaderboard(): Promise<WeeklyLeagueEntry[]> {
  try {
    const response = await fetch("/api/leaderboard?scope=weekly", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as LeaderboardResponse<WeeklyLeagueEntry>;
    return Array.isArray(payload.entries) ? payload.entries : [];
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
  tableId?: string | null;
  avatarUrl?: string | null;
  category?: QuizCategoryId | string | null;
  submissionId?: string;
}): Promise<QuizLeaderboardEntry | null> {
  void input.tenantId;
  void input.clientId;
  void input.avatar;
  void input.tableId;
  if ((input.gameType ?? "quiz") !== "blockblast") return null;
  try {
    const response = await fetch("/api/leaderboard", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameKey: input.gameType ?? "quiz",
        rawScore: Math.round(input.score),
        category:
          input.gameType === "blockblast"
            ? ""
            : (input.category ?? "").toString().toLowerCase(),
        nickname: input.nickname.slice(0, 64),
        avatarUrl: resolveScoreAvatarUrl(input.avatarUrl),
        submissionId: input.submissionId,
      }),
    });
    const payload = (await response.json()) as LeaderboardResponse<GameLeaderboardApiEntry>;
    return response.ok && payload.accepted === true && payload.entry
      ? fromApi(payload.entry)
      : null;
  } catch {
    return null;
  }
}
