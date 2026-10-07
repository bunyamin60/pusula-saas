import "server-only";

import { getGameLeaderboard, type GameLeaderboardEntry } from "@/lib/leaderboardServer";
import { getServerQuizCategory } from "@/lib/quizBank.server";
import {
  isQuizCategoryId,
  type QuizCategoryId,
  type QuizQuestion,
} from "@/lib/quizBank";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type RpcResult = Record<string, unknown>;

export type StartedQuizAttempt = {
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

export type StartedQuizQuestion = {
  questionDeadlineAt: string;
  questionDurationMs: number;
};

export type SubmittedQuizAnswer = {
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
  entry: GameLeaderboardEntry | null;
};

export class QuizRequestError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

function objectResult(data: unknown): RpcResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new QuizRequestError("invalid_response");
  }
  return data as RpcResult;
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [result[index], result[random]] = [result[random], result[index]];
  }
  return result;
}

export async function startQuizAttempt(input: {
  guestId: string;
  category: QuizCategoryId;
  nickname: string;
  avatarUrl: string | null;
}): Promise<StartedQuizAttempt> {
  const category = getServerQuizCategory(input.category);
  if (!category) throw new QuizRequestError("invalid_category");
  const questions = shuffled(category.questions);

  const { data, error } = await getSupabaseAdmin().rpc("start_quiz_attempt", {
    p_guest_id: input.guestId,
    p_category: input.category,
    p_question_ids: questions.map((question) => question.id),
    p_answer_key: questions.map((question) => question.answer),
    p_nickname: input.nickname,
    p_avatar_url: input.avatarUrl,
  });
  if (error) throw error;

  const result = objectResult(data);
  if (result.ok !== true) {
    throw new QuizRequestError(
      typeof result.reason === "string" ? result.reason : "quiz_start_failed",
    );
  }
  const resultCategory =
    typeof result.category === "string" && isQuizCategoryId(result.category)
      ? result.category
      : null;
  const resultQuestionIds = Array.isArray(result.question_ids)
    ? result.question_ids.filter(
        (questionId): questionId is string => typeof questionId === "string",
      )
    : [];
  const resultBank = resultCategory
    ? getServerQuizCategory(resultCategory)
    : null;
  const questionById = new Map(
    resultBank?.questions.map((question) => [question.id, question]) ?? [],
  );
  const resultQuestions = resultQuestionIds
    .map((questionId) => questionById.get(questionId))
    .filter((question) => question != null);

  if (
    typeof result.attempt_id !== "string" ||
    typeof result.expires_at !== "string" ||
    !resultCategory ||
    resultQuestions.length !== resultQuestionIds.length ||
    resultQuestions.length === 0
  ) {
    throw new QuizRequestError("invalid_response");
  }

  return {
    attemptId: result.attempt_id,
    category: resultCategory,
    expiresAt: result.expires_at,
    currentIndex:
      typeof result.current_index === "number" ? result.current_index : 0,
    rawScore: typeof result.raw_score === "number" ? result.raw_score : 0,
    questionDurationMs:
      typeof result.question_duration_ms === "number"
        ? result.question_duration_ms
        : 10_000,
    questionDeadlineAt:
      typeof result.question_deadline_at === "string"
        ? result.question_deadline_at
        : null,
    eligibleForLeague: result.eligible_for_league === true,
    questions: resultQuestions.map(({ id, prompt, options }) => ({
      id,
      prompt,
      options,
    })),
  };
}

export async function startQuizQuestion(input: {
  guestId: string;
  attemptId: string;
  questionId: string;
}): Promise<StartedQuizQuestion> {
  const { data, error } = await getSupabaseAdmin().rpc("start_quiz_question", {
    p_guest_id: input.guestId,
    p_attempt_id: input.attemptId,
    p_question_id: input.questionId,
  });
  if (error) throw error;

  const result = objectResult(data);
  if (result.ok !== true) {
    throw new QuizRequestError(
      typeof result.reason === "string" ? result.reason : "quiz_question_failed",
    );
  }
  if (typeof result.question_deadline_at !== "string") {
    throw new QuizRequestError("invalid_response");
  }

  return {
    questionDeadlineAt: result.question_deadline_at,
    questionDurationMs:
      typeof result.question_duration_ms === "number"
        ? result.question_duration_ms
        : 10_000,
  };
}

export async function submitQuizAnswer(input: {
  guestId: string;
  attemptId: string;
  questionId: string;
  answerIndex: number;
}): Promise<SubmittedQuizAnswer> {
  const { data, error } = await getSupabaseAdmin().rpc("submit_quiz_answer", {
    p_guest_id: input.guestId,
    p_attempt_id: input.attemptId,
    p_question_id: input.questionId,
    p_answer_index: input.answerIndex,
  });
  if (error) throw error;

  const result = objectResult(data);
  if (result.ok !== true) {
    throw new QuizRequestError(
      typeof result.reason === "string" ? result.reason : "quiz_answer_failed",
    );
  }

  const completed = result.completed === true;
  const entries = completed
    ? await getGameLeaderboard({
        guestId: input.guestId,
        gameKey: "quiz",
        category: typeof result.category === "string" ? result.category : null,
      })
    : [];

  return {
    correct: result.correct === true,
    correctAnswer:
      typeof result.correct_answer === "number" ? result.correct_answer : -1,
    pointsAwarded:
      typeof result.points_awarded === "number" ? result.points_awarded : 0,
    rawScore: typeof result.raw_score === "number" ? result.raw_score : 0,
    completed,
    duplicate: result.duplicate === true,
    timedOut: result.timed_out === true,
    responseTimeMs:
      typeof result.response_time_ms === "number" ? result.response_time_ms : 0,
    eligibleForLeague: result.eligible_for_league === true,
    category: result.category as QuizCategoryId,
    entry: entries.find((entry) => entry.isCurrent) ?? null,
  };
}

export function logQuizError(scope: string, error: unknown): void {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  console.error(`[quiz:${scope}] request failed`, {
    code: typeof candidate?.code === "string" ? candidate.code : "unknown",
    message:
      typeof candidate?.message === "string"
        ? candidate.message.slice(0, 500)
        : "Unexpected quiz error",
  });
}
