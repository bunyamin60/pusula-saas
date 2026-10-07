import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import { isGuestAvatarUrl } from "@/lib/guestAvatars";
import { isUuid } from "@/lib/guestSessionServer";
import { isQuizCategoryId } from "@/lib/quizBank";
import {
  logQuizError,
  QuizRequestError,
  startQuizAttempt,
  startQuizQuestion,
  submitQuizAnswer,
} from "@/lib/quizServer";

function errorStatus(reason: string): number {
  if (reason === "active_session_required" || reason === "venue_verification_required") {
    return 403;
  }
  if (reason === "attempt_not_found") return 404;
  if (
    reason === "attempt_expired" ||
    reason === "question_not_started" ||
    reason === "invalid_question"
  ) {
    return 409;
  }
  return 400;
}

function quizErrorResponse(
  error: unknown,
  token: string,
  fresh: boolean,
  scope: string,
) {
  if (error instanceof QuizRequestError) {
    return applyDeviceCookie(
      NextResponse.json(
        { ok: false, reason: error.reason },
        { status: errorStatus(error.reason) },
      ),
      token,
      fresh,
    );
  }
  logQuizError(scope, error);
  return applyDeviceCookie(
    NextResponse.json(
      { ok: false, reason: "quiz-request-failed" },
      { status: 500 },
    ),
    token,
    fresh,
  );
}

export async function POST(request: Request) {
  const device = await resolveDevice(request);
  try {
    const body = (await request.json()) as {
      category?: unknown;
      nickname?: unknown;
      avatarUrl?: unknown;
    };
    const category =
      typeof body.category === "string" ? body.category.trim().toLowerCase() : "";
    if (!isQuizCategoryId(category)) {
      throw new QuizRequestError("invalid_category");
    }

    const attempt = await startQuizAttempt({
      guestId: device.id,
      category,
      nickname:
        typeof body.nickname === "string" ? body.nickname.trim().slice(0, 64) : "",
      avatarUrl:
        typeof body.avatarUrl === "string" && isGuestAvatarUrl(body.avatarUrl)
          ? body.avatarUrl
          : null,
    });
    return applyDeviceCookie(
      NextResponse.json({ ok: true, attempt }),
      device.token,
      device.fresh,
    );
  } catch (error) {
    return quizErrorResponse(error, device.token, device.fresh, "start");
  }
}

export async function PUT(request: Request) {
  const device = await resolveDevice(request);
  try {
    const body = (await request.json()) as {
      attemptId?: unknown;
      questionId?: unknown;
    };
    const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
    const questionId =
      typeof body.questionId === "string" ? body.questionId.trim() : "";
    if (!isUuid(attemptId) || !questionId) {
      throw new QuizRequestError("invalid_request");
    }

    const question = await startQuizQuestion({
      guestId: device.id,
      attemptId,
      questionId,
    });
    return applyDeviceCookie(
      NextResponse.json({ ok: true, question }),
      device.token,
      device.fresh,
    );
  } catch (error) {
    return quizErrorResponse(error, device.token, device.fresh, "question");
  }
}

export async function PATCH(request: Request) {
  const device = await resolveDevice(request);
  try {
    const body = (await request.json()) as {
      attemptId?: unknown;
      questionId?: unknown;
      answerIndex?: unknown;
    };
    const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
    const questionId =
      typeof body.questionId === "string" ? body.questionId.trim() : "";
    const answerIndex =
      typeof body.answerIndex === "number" && Number.isInteger(body.answerIndex)
        ? body.answerIndex
        : null;
    if (!isUuid(attemptId) || !questionId || answerIndex === null) {
      throw new QuizRequestError("invalid_request");
    }

    const answer = await submitQuizAnswer({
      guestId: device.id,
      attemptId,
      questionId,
      answerIndex,
    });
    return applyDeviceCookie(
      NextResponse.json({ ok: true, answer }),
      device.token,
      device.fresh,
    );
  } catch (error) {
    return quizErrorResponse(error, device.token, device.fresh, "answer");
  }
}
