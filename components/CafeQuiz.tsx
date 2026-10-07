"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DuelLeaderboard } from "@/components/DuelLeaderboard";
import { GameCountdown } from "@/components/GameCountdown";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import { readCustomerProfile } from "@/lib/customerProfile";
import type { QuizLeaderboardEntry } from "@/lib/duelLeaderboard";
import { awardXp } from "@/lib/economy";
import {
  QUIZ_CATEGORY_IDS,
  quizCategoryTitle,
  type QuizCategoryId,
  type QuizQuestion,
} from "@/lib/quizBank";
import {
  answerQuizQuestion,
  beginQuizQuestion,
  createQuizAttempt,
  type QuizAnswer,
} from "@/lib/quizAttempt";
import { getActiveTableLabel } from "@/lib/tableSession";
import { writeLobbyRaceFocus, writeLobbyTab, writeVenueHomeView } from "@/lib/venueHome";

const LETTERS = ["A", "B", "C", "D"] as const;
type Phase = "setup" | "countdown" | "playing" | "done";

function quizNickname(tenantId: string) {
  const profile = readCustomerProfile();
  if (profile?.name) return profile.name;
  return tenantConfig.copy.duel.guestPlayer.replace(
    "{table}",
    getActiveTableLabel(tenantId),
  );
}

function rankMessage(
  entry: QuizLeaderboardEntry | null,
  copy: typeof tenantConfig.copy.duel,
): string {
  if (!entry?.rank) return copy.rankFallback;
  const template = entry.rank <= 5 ? copy.rankTop : copy.rankOther;
  return template.replace("{rank}", String(entry.rank));
}

export function CafeQuiz() {
  const copy = tenantConfig.copy.duel;
  const router = useRouter();
  const { tenantId, player } = useDuel();
  const [phase, setPhase] = useState<Phase>("setup");
  const [categoryId, setCategoryId] = useState<QuizCategoryId>("cafe");
  const [playedCategory, setPlayedCategory] = useState<QuizCategoryId | null>(
    null,
  );
  const [items, setItems] = useState<QuizQuestion[]>([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [boardReady, setBoardReady] = useState(false);
  const [submitted, setSubmitted] = useState<QuizLeaderboardEntry | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questionDeadlineAt, setQuestionDeadlineAt] = useState<string | null>(
    null,
  );
  const [questionDurationMs, setQuestionDurationMs] = useState(10_000);
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const xpAttemptRef = useRef<string | null>(null);

  async function startCategory() {
    if (starting) return;
    setStarting(true);
    setErrorMessage(null);
    setScore(0);
    setRound(0);
    setSubmitted(null);
    setBoardReady(false);
    try {
      const attempt = await createQuizAttempt({
        category: categoryId,
        nickname: quizNickname(tenantId),
        avatarUrl: readCustomerProfile()?.avatarUrl,
      });
      setAttemptId(attempt.attemptId);
      setItems(attempt.questions);
      setPlayedCategory(attempt.category);
      setRound(attempt.currentIndex);
      setScore(attempt.rawScore);
      setQuestionDurationMs(attempt.questionDurationMs);
      setQuestionDeadlineAt(attempt.questionDeadlineAt);
      xpAttemptRef.current = null;
      setPhase(attempt.questionDeadlineAt ? "playing" : "countdown");
    } catch {
      setErrorMessage("Quiz başlatılamadı. Mekan doğrulamanı kontrol edip tekrar dene.");
    } finally {
      setStarting(false);
    }
  }

  async function beginQuestion(questionIndex: number) {
    const question = items[questionIndex];
    if (!attemptId || !question) throw new Error("quiz_question_missing");
    const timing = await beginQuizQuestion({
      attemptId,
      questionId: question.id,
    });
    setQuestionDurationMs(timing.questionDurationMs);
    setQuestionDeadlineAt(timing.questionDeadlineAt);
  }

  async function finishCountdown() {
    try {
      await beginQuestion(round);
      setPhase("playing");
    } catch {
      setErrorMessage(
        "Quiz sorusu başlatılamadı. Mekan doğrulamanı kontrol edip tekrar dene.",
      );
      setPhase("setup");
    }
  }

  async function advanceQuestion() {
    if (round + 1 >= items.length) {
      setPhase("done");
      return;
    }
    const nextRound = round + 1;
    await beginQuestion(nextRound);
    setRound(nextRound);
  }

  async function submitAnswer(
    questionId: string,
    answerIndex: number,
  ): Promise<QuizAnswer> {
    if (!attemptId) throw new Error("quiz_attempt_missing");
    const answer = await answerQuizQuestion({
      attemptId,
      questionId,
      answerIndex,
    });
    setScore(answer.rawScore);
    if (answer.completed) {
      setSubmitted(answer.entry);
      setBoardReady(true);
      if (xpAttemptRef.current !== attemptId) {
        xpAttemptRef.current = attemptId;
        void awardXp({
          tenantId,
          clientId: player.clientId,
          activityName: "quiz",
          score: answer.rawScore,
        });
      }
    }
    return answer;
  }

  function playAgain() {
    setSubmitted(null);
    setBoardReady(false);
    setPlayedCategory(null);
    setItems([]);
    setAttemptId(null);
    setQuestionDeadlineAt(null);
    setQuestionDurationMs(10_000);
    setRound(0);
    setScore(0);
    setErrorMessage(null);
    xpAttemptRef.current = null;
    setPhase("setup");
  }

  function openLeaderboard() {
    writeVenueHomeView(tenantId, "lobby");
    writeLobbyTab(tenantId, "events");
    writeLobbyRaceFocus(tenantId, "quiz");
    router.push(`/${tenantId}`);
  }

  if (phase === "setup") {
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <h2 className="font-sans text-xl font-extrabold tracking-tight text-[var(--text-headline)]">
          {copy.quizPickTitle}
        </h2>
        <p className="mt-1 font-sans text-sm font-medium text-[var(--text-body)]">
          {copy.quizPickLead}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {QUIZ_CATEGORY_IDS.map((id) => {
            const active = categoryId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategoryId(id)}
                className={`min-h-12 rounded-2xl border-2 px-3 py-3 font-sans text-sm font-black transition active:scale-95 ${
                  active
                    ? "border-[var(--btn-primary)] bg-[var(--btn-primary)] text-[var(--btn-text)]"
                    : "border-[var(--border)] bg-[var(--card-surface)] text-[var(--text-headline)]"
                }`}
              >
                {quizCategoryTitle(id)}
              </button>
            );
          })}
        </div>
        {errorMessage ? (
          <p className="mt-3 text-center font-sans text-xs font-semibold text-red-600">
            {errorMessage}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void startCategory()}
          disabled={starting}
          className="mt-auto min-h-14 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg transition active:scale-95 active:brightness-95"
        >
          {starting ? "Quiz hazırlanıyor..." : copy.quizStart}
        </button>
      </section>
    );
  }

  if (phase === "countdown") {
    return (
      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <GameCountdown onDone={() => void finishCountdown()} />
      </section>
    );
  }

  const item = items[round];

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {phase === "done" || !item ? (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto text-center">
          <p className="font-sans text-4xl font-extrabold tracking-tight text-[var(--text-headline)]">
            {score}
          </p>
          <p className="mt-3 font-sans text-base font-extrabold tracking-tight text-[var(--text-headline)]">
            {rankMessage(submitted, copy)}
          </p>
          {playedCategory ? (
            <p className="mt-1 font-sans text-xs font-bold uppercase tracking-wider text-[var(--text-body)]">
              {quizCategoryTitle(playedCategory)}
            </p>
          ) : null}
          <p className="mt-2 font-sans text-sm font-medium text-[var(--text-body)]">
            Bu haftanın sıralaması
          </p>
          {boardReady ? (
            <div className="mt-6 text-left">
              <DuelLeaderboard
                tenantId={tenantId}
                player={player}
                score={score}
                category={playedCategory}
              />
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-2 pb-2">
            <button
              type="button"
              onClick={playAgain}
              className="min-h-12 w-full rounded-2xl bg-[var(--btn-primary)] px-4 py-3.5 font-sans text-sm font-black text-[var(--btn-text)] shadow-lg transition active:scale-95 active:brightness-95"
            >
              {copy.quizPlayAgain}
            </button>
            <button
              type="button"
              onClick={openLeaderboard}
              className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] px-4 py-3 font-sans text-sm font-bold text-[var(--text-headline)] transition active:scale-95"
            >
              {copy.quizOpenLeaderboard}
            </button>
          </div>
        </div>
      ) : (
        <QuizRound
          key={item.id}
          questionId={item.id}
          questionDeadlineAt={questionDeadlineAt}
          questionDurationMs={questionDurationMs}
          prompt={item.prompt}
          options={item.options}
          current={round + 1}
          total={items.length}
          roundLabel={copy.roundTemplate}
          secondsLabel={copy.seconds}
          letters={copy.optionLetters ?? LETTERS}
          nextLabel={copy.nextQuestion}
          resultsLabel={copy.seeResults}
          onAnswer={submitAnswer}
          onAdvance={advanceQuestion}
        />
      )}
    </section>
  );
}

function QuizRound({
  questionId,
  questionDeadlineAt,
  questionDurationMs,
  prompt,
  options,
  current,
  total,
  roundLabel,
  secondsLabel,
  letters,
  nextLabel,
  resultsLabel,
  onAnswer,
  onAdvance,
}: {
  questionId: string;
  questionDeadlineAt: string | null;
  questionDurationMs: number;
  prompt: string;
  options: readonly string[];
  current: number;
  total: number;
  roundLabel: string;
  secondsLabel: string;
  letters: readonly string[];
  nextLabel: string;
  resultsLabel: string;
  onAnswer: (questionId: string, answerIndex: number) => Promise<QuizAnswer>;
  onAdvance: () => Promise<void>;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Date.parse(questionDeadlineAt ?? "") - Date.now()),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState(false);
  const [advanceError, setAdvanceError] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const timeoutSubmittedRef = useRef(false);
  const locked = selected != null;

  const submitChoice = useCallback(
    async (index: number) => {
      if (selected != null || submitting) return;
      setSelected(index);
      setSubmitting(true);
      setAnswerError(false);
      try {
        const result = await onAnswer(questionId, index);
        setCorrectAnswer(result.correctAnswer);
      } catch {
        setSelected(null);
        setAnswerError(true);
      } finally {
        setSubmitting(false);
      }
    },
    [onAnswer, questionId, selected, submitting],
  );

  useEffect(() => {
    if (locked) return;
    const deadline = Date.parse(questionDeadlineAt ?? "");
    if (!Number.isFinite(deadline)) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left <= 0 && !timeoutSubmittedRef.current) {
        timeoutSubmittedRef.current = true;
        window.clearInterval(timer);
        void submitChoice(-1);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [locked, questionDeadlineAt, submitChoice]);

  function choose(index: number) {
    void submitChoice(index);
  }

  async function advance() {
    if (advancing) return;
    setAdvancing(true);
    setAdvanceError(false);
    try {
      await onAdvance();
    } catch {
      setAdvanceError(true);
    } finally {
      setAdvancing(false);
    }
  }

  const urgent = remaining < 4000 && !locked;

  return (
    <div className="flex h-full min-h-0 max-h-full w-full min-w-0 flex-1 flex-col justify-between overflow-x-hidden overflow-hidden">
      <div className="shrink-0">
        <div className="flex items-center justify-between font-sans text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-body)]">
          <span>
            {roundLabel
              .replace("{current}", String(current))
              .replace("{total}", String(total))}
          </span>
          <span>
            {secondsLabel.replace(
              "{seconds}",
              String(Math.ceil(remaining / 1000)),
            )}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--card-surface)]">
          <div
            className={`h-full rounded-full bg-[var(--btn-primary)] ${
              urgent ? "quiz-timer-pulse" : ""
            }`}
            style={{
              width: `${Math.min(100, (remaining / questionDurationMs) * 100)}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-3 min-h-0 min-w-0 shrink rounded-2xl border border-[var(--border)] bg-[var(--card-surface)] p-3.5 text-center shadow-sm">
        <h2 className="font-sans text-lg font-extrabold leading-snug tracking-tight text-[var(--text-headline)]">
          {prompt}
        </h2>
      </div>

      <div className="mt-3 grid min-w-0 shrink-0 gap-2 overflow-x-hidden">
        {options.map((option, index) => {
          const chosen = selected === index;
          const answered = correctAnswer != null;
          const isCorrect = answered && index === correctAnswer;
          const isWrong = answered && chosen && index !== correctAnswer;
          const idleLocked = answered && !isCorrect && !isWrong;
          const letter = letters[index] ?? String(index + 1);
          return (
            <button
              key={option}
              type="button"
              disabled={locked || submitting}
              onClick={() => choose(index)}
              className={`flex min-h-[48px] w-full min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-2xl border-2 px-3.5 py-2.5 text-left font-sans text-sm font-bold transition-colors active:scale-[0.98] ${
                isCorrect
                  ? "quiz-flash-ok border-[var(--quiz-ok-border)] bg-[var(--quiz-ok)] text-[var(--quiz-on-feedback)]"
                  : isWrong
                    ? "quiz-flash-bad border-[var(--quiz-bad-border)] bg-[var(--quiz-bad)] text-[var(--quiz-on-feedback)]"
                    : idleLocked
                      ? "border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[var(--card-surface)] text-[var(--text-headline)] opacity-50"
                      : "border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[var(--card-surface)] text-[var(--text-headline)] hover:bg-[var(--card-surface)]/80"
              }`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full font-sans text-[11px] font-extrabold ${
                  isCorrect || isWrong
                    ? "bg-[color-mix(in_srgb,var(--quiz-on-feedback)_22%,transparent)] text-[var(--quiz-on-feedback)]"
                    : "bg-[var(--bg-canvas)] text-[var(--text-headline)]"
                }`}
              >
                {letter}
              </span>
              <span className="min-w-0 flex-1 break-words leading-snug">
                {option}
              </span>
            </button>
          );
        })}
      </div>

      {answerError ? (
        <p className="mt-2 text-center font-sans text-xs font-semibold text-red-600">
          Cevap kaydedilemedi. Tekrar dene.
        </p>
      ) : null}

      {advanceError ? (
        <p className="mt-2 text-center font-sans text-xs font-semibold text-red-600">
          Sonraki soru başlatılamadı. Tekrar dene.
        </p>
      ) : null}

      <button
        type="button"
        disabled={correctAnswer == null || submitting || advancing}
        onClick={() => void advance()}
        className={`mt-auto min-h-[48px] w-full shrink-0 rounded-2xl bg-[var(--btn-primary)] py-3 font-sans text-base font-extrabold text-[var(--btn-text)] shadow-md transition-all ${
          correctAnswer != null && !submitting && !advancing
            ? "hover:brightness-95 active:scale-95 active:brightness-95"
            : "cursor-not-allowed opacity-50"
        }`}
      >
        {current >= total ? resultsLabel : nextLabel}
      </button>
    </div>
  );
}
