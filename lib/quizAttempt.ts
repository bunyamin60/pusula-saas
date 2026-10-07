import type { QuizLeaderboardEntry } from "@/lib/duelLeaderboard";
import type { QuizCategoryId, QuizQuestion } from "@/lib/quizBank";

export type QuizAttempt = {
  attemptId: string;
  category: QuizCategoryId;
  expiresAt: string;
  questions: QuizQuestion[];
  currentIndex: number;
  rawScore: number;
  questionDurationMs: number;
  questionDeadlineAt: string | null;
  eligibleForLeague: boolean;
};

export type QuizAnswer = {
  correct: boolean;
  correctAnswer: number;
  pointsAwarded: number;
  rawScore: number;
  completed: boolean;
  duplicate: boolean;
  timedOut: boolean;
  responseTimeMs: number;
  eligibleForLeague: boolean;
  category: QuizCategoryId;
  entry: QuizLeaderboardEntry | null;
};

type ApiGameLeaderboardEntry = {
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

type ApiQuizAnswer = Omit<QuizAnswer, "entry"> & {
  entry: ApiGameLeaderboardEntry | null;
};

type ApiResponse<T> = {
  ok: boolean;
  reason?: string;
  attempt?: T;
  answer?: T;
  question?: T;
};

export async function createQuizAttempt(input: {
  category: QuizCategoryId;
  nickname: string;
  avatarUrl?: string | null;
}): Promise<QuizAttempt> {
  const response = await fetch("/api/quiz/attempt", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as ApiResponse<QuizAttempt>;
  if (!response.ok || !payload.attempt) {
    throw new Error(payload.reason || "quiz_start_failed");
  }
  return payload.attempt;
}

export async function beginQuizQuestion(input: {
  attemptId: string;
  questionId: string;
}): Promise<{ questionDeadlineAt: string; questionDurationMs: number }> {
  const response = await fetch("/api/quiz/attempt", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as ApiResponse<{
    questionDeadlineAt: string;
    questionDurationMs: number;
  }>;
  if (!response.ok || !payload.question) {
    throw new Error(payload.reason || "quiz_question_failed");
  }
  return payload.question;
}

export async function answerQuizQuestion(input: {
  attemptId: string;
  questionId: string;
  answerIndex: number;
}): Promise<QuizAnswer> {
  const response = await fetch("/api/quiz/attempt", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as ApiResponse<ApiQuizAnswer>;
  if (!response.ok || !payload.answer) {
    throw new Error(payload.reason || "quiz_answer_failed");
  }
  const { entry, ...answer } = payload.answer;
  return {
    ...answer,
    entry: entry
      ? {
          tenantId: "",
          clientId: entry.playerKey,
          nickname: entry.nickname,
          avatar: "",
          score: entry.rawScore,
          completedAt: entry.submittedAt,
          rank: Number(entry.rank),
          tableId: null,
          avatarUrl: entry.avatarUrl,
          category: entry.category || null,
          isCurrent: entry.isCurrent,
          weekStart: entry.weekStart,
        }
      : null,
  };
}
