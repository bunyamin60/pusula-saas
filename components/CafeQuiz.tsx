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
      <section className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <GameCountdown onDone={() => setIntroDone(true)} />
      </section>
    );
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      {done || !item ? (
        <div className="mt-6 text-center">
          <p className="font-sans text-4xl font-extrabold tracking-tight text-ink">{score}</p>
          <p className="mt-2 font-sans text-sm font-medium text-muted">{copy.leaderboardAllTime}</p>
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
    <div className="mt-4 flex flex-1 flex-col pb-2">
      <div className="flex items-center justify-between font-sans text-xs font-medium uppercase tracking-[0.1em] text-muted">
        <span>
          {roundLabel
            .replace("{current}", String(current))
            .replace("{total}", String(total))}
        </span>
        <span>{secondsLabel.replace("{seconds}", String(Math.ceil(remaining / 1000)))}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full bg-primary ${
            urgent ? "quiz-timer-pulse" : ""
          }`}
          style={{ width: `${remaining / 100}%` }}
        />
      </div>
      <div className="mt-6 rounded-2xl border border-ink/15 bg-surface p-6 text-center shadow-sm">
        <h2 className="font-sans text-2xl font-extrabold leading-tight tracking-tight text-on-surface">{prompt}</h2>
      </div>
      <div className="mt-5 grid gap-3">
        {options.map((option, index) => {
          const chosen = selected === index;
          const isCorrect = locked && index === answer;
          const isWrong = chosen && index !== answer;
          const letter = letters[index] ?? String(index + 1);
          return (
            <button
              key={option}
              type="button"
              disabled={locked}
              onClick={() => choose(index)}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-left font-sans text-sm font-bold shadow-sm transition hover:brightness-95 active:scale-95 ${
                isCorrect
                  ? "quiz-flash-ok scale-[1.02] border-emerald-400 bg-emerald-500/15 text-emerald-900"
                  : isWrong
                    ? "quiz-flash-bad scale-[1.02] border-rose-400 bg-rose-500/15 text-rose-800"
                    : "border-transparent bg-primary text-on-primary"
              }`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full font-sans text-[11px] font-extrabold ${
                  isCorrect || isWrong
                    ? "bg-background text-ink"
                    : "bg-ink/10 text-on-primary"
                }`}
              >
                {letter}
              </span>
              <span className="min-w-0 flex-1 py-3 leading-snug">{option}</span>
            </button>
          );
        })}
      </div>
      {locked ? (
        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={onAdvance}
            className="w-full py-4 rounded-2xl bg-[var(--btn-primary)] text-[var(--btn-text)] font-extrabold shadow-md hover:brightness-95 active:scale-95 transition-all text-base"
          >
            {current >= total ? resultsLabel : nextLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
