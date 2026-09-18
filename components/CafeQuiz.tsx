"use client";

import { useEffect, useRef, useState } from "react";
import { DuelLeaderboard } from "@/components/DuelLeaderboard";
import { GameCountdown } from "@/components/GameCountdown";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import { readCustomerProfile } from "@/lib/customerProfile";
import { submitQuizScore } from "@/lib/duelLeaderboard";

const LETTERS = ["A", "B", "C", "D"] as const;

function quizNickname() {
  const profile = readCustomerProfile();
  if (profile?.name) return profile.name;
  return tenantConfig.copy.duel.guestPlayer.replace(
    "{table}",
    tenantConfig.brand.tableName,
  );
}

export function CafeQuiz() {
  const copy = tenantConfig.copy.duel;
  const items = tenantConfig.duel.quiz;
  const { tenantId, player } = useDuel();
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!done) return;
    void submitQuizScore({
      tenantId,
      clientId: player.clientId,
      nickname: quizNickname(),
      avatar: player.avatar,
      score: scoreRef.current,
    }).finally(() => setBoardReady(true));
  }, [done, player.avatar, player.clientId, tenantId]);

  const item = items[round];

  if (!introDone) {
    return (
      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <GameCountdown onDone={() => setIntroDone(true)} />
      </section>
    );
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {done || !item ? (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto text-center">
          <p className="font-sans text-4xl font-extrabold tracking-tight text-[var(--text-headline)]">{score}</p>
          <p className="mt-2 font-sans text-sm font-medium text-[var(--text-body)]">{copy.leaderboardAllTime}</p>
          {boardReady ? (
            <div className="mt-6 text-left">
              <DuelLeaderboard tenantId={tenantId} player={player} score={score} />
            </div>
          ) : null}
        </div>
      ) : (
        <QuizRound
          key={item.prompt}
          prompt={item.prompt}
          options={item.options}
          answer={item.answer}
          current={round + 1}
          total={items.length}
          roundLabel={copy.roundTemplate}
          secondsLabel={copy.seconds}
          letters={copy.optionLetters ?? LETTERS}
          nextLabel={copy.nextQuestion}
          resultsLabel={copy.seeResults}
          onPoints={(points) => {
            scoreRef.current += points;
            setScore(scoreRef.current);
          }}
          onAdvance={() => {
            if (round + 1 >= items.length) {
              setDone(true);
              return;
            }
            setRound((current) => current + 1);
          }}
        />
      )}
    </section>
  );
}

function QuizRound({
  prompt,
  options,
  answer,
  current,
  total,
  roundLabel,
  secondsLabel,
  letters,
  nextLabel,
  resultsLabel,
  onPoints,
  onAdvance,
}: {
  prompt: string;
  options: readonly string[];
  answer: number;
  current: number;
  total: number;
  roundLabel: string;
  secondsLabel: string;
  letters: readonly string[];
  nextLabel: string;
  resultsLabel: string;
  onPoints: (points: number) => void;
  onAdvance: () => void;
}) {
  const [remaining, setRemaining] = useState(10_000);
  const [selected, setSelected] = useState<number | null>(null);
  const locked = selected != null;

  useEffect(() => {
    if (locked) return;
    const start = Date.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, 10_000 - (Date.now() - start));
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(timer);
        setSelected(-1);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [locked]);

  function choose(index: number) {
    if (locked) return;
    setSelected(index);
    if (index === answer) onPoints(100 + Math.ceil(remaining / 100));
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
          <span>{secondsLabel.replace("{seconds}", String(Math.ceil(remaining / 1000)))}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--card-surface)]">
          <div
            className={`h-full rounded-full bg-[var(--btn-primary)] ${
              urgent ? "quiz-timer-pulse" : ""
            }`}
            style={{ width: `${remaining / 100}%` }}
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
          const isCorrect = locked && index === answer;
          const isWrong = chosen && index !== answer;
          const idleLocked = locked && !isCorrect && !isWrong;
          const letter = letters[index] ?? String(index + 1);
          return (
            <button
              key={option}
              type="button"
              disabled={locked}
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
              <span className="min-w-0 flex-1 break-words leading-snug">{option}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!locked}
        onClick={onAdvance}
        className={`mt-auto min-h-[48px] w-full shrink-0 rounded-2xl bg-[var(--btn-primary)] py-3 font-sans text-base font-extrabold text-[var(--btn-text)] shadow-md transition-all ${
          locked
            ? "hover:brightness-95 active:scale-95 active:brightness-95"
            : "cursor-not-allowed opacity-50"
        }`}
      >
        {current >= total ? resultsLabel : nextLabel}
      </button>
    </div>
  );
}
