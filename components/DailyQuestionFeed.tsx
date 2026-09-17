"use client";

import { useEffect, useRef, useState } from "react";
import { tenantConfig } from "@/config/tenant.config";
import { readCustomerProfile } from "@/lib/customerProfile";
import {
  fetchActiveQuestion,
  fetchDailyAnswerById,
  fetchDailyAnswers,
  formatGossipClock,
  gossipCooldownRemaining,
  GOSSIP_MAX_CHARS,
  likeDailyAnswer,
  readLastGossipAnswerId,
  readLikedGossipIds,
  submitDailyAnswer,
  subscribeDailyFeed,
  type DailyAnswer,
  type DailyQuestion,
} from "@/lib/dailyQuestion";

export function DailyQuestionFeed({
  tenantId,
  clientId,
}: {
  tenantId: string;
  clientId: string;
}) {
  const copy = tenantConfig.copy.landing.gossip;
  const lastOwnId = useRef<string | null>(null);
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [answers, setAnswers] = useState<DailyAnswer[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [liked, setLiked] = useState<string[]>([]);
  const [popId, setPopId] = useState<string | null>(null);
  const [waitMs, setWaitMs] = useState(0);
  const [ownHidden, setOwnHidden] = useState(false);

  useEffect(() => {
    setLiked(readLikedGossipIds());
    lastOwnId.current = readLastGossipAnswerId();
  }, []);

  useEffect(() => {
    const tick = () => setWaitMs(gossipCooldownRemaining());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [notice, answers.length, ownHidden]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const nextQuestion = await fetchActiveQuestion(tenantId);
      if (!active) return;
      setQuestion(nextQuestion);
      if (!nextQuestion) {
        setAnswers([]);
        return;
      }
      const nextAnswers = await fetchDailyAnswers(tenantId, {
        questionId: nextQuestion.id,
      });
      if (active) setAnswers(nextAnswers);
      const ownId = lastOwnId.current;
      if (!ownId) return;
      const own = await fetchDailyAnswerById(ownId);
      if (!active) return;
      setOwnHidden(!own || own.isHidden);
    })();
    return () => {
      active = false;
    };
  }, [tenantId]);

  useEffect(() => {
    return subscribeDailyFeed(tenantId, {
      onQuestion: (next) => {
        if (!next.isActive) return;
        setQuestion(next);
        void fetchDailyAnswers(tenantId, { questionId: next.id }).then(setAnswers);
      },
      onAnswer: (answer) => {
        if (answer.isHidden) return;
        setQuestion((current) => {
          if (current && answer.questionId !== current.id) return current;
          setAnswers((list) => {
            if (list.some((item) => item.id === answer.id)) return list;
            return [answer, ...list];
          });
          return current;
        });
      },
      onAnswerUpdate: (answer) => {
        if (lastOwnId.current === answer.id) setOwnHidden(answer.isHidden);
        setAnswers((list) => {
          if (answer.isHidden) return list.filter((item) => item.id !== answer.id);
          return list.map((item) => (item.id === answer.id ? answer : item));
        });
      },
      onAnswerDelete: (id) => {
        if (lastOwnId.current === id) setOwnHidden(true);
        setAnswers((list) => list.filter((item) => item.id !== id));
      },
    });
  }, [tenantId]);

  function authorLabel() {
    const profile = readCustomerProfile();
    if (profile?.name) return profile.name;
    return tenantConfig.brand.tableName;
  }

  async function send() {
    if (!question || busy || waitMs > 0) return;
    setNotice(null);
    setBusy(true);
    const result = await submitDailyAnswer({
      tenantId,
      questionId: question.id,
      authorLabel: authorLabel(),
      body: draft,
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(
        result.reason === "wait"
          ? copy.wait
          : result.reason === "blocked"
            ? copy.blocked
            : copy.offline,
      );
      return;
    }
    lastOwnId.current = result.answer.id;
    setOwnHidden(false);
    setDraft("");
    setAnswers((list) => {
      if (list.some((item) => item.id === result.answer.id)) return list;
      return [result.answer, ...list];
    });
    setWaitMs(gossipCooldownRemaining());
  }

  async function like(id: string) {
    if (liked.includes(id)) return;
    setLiked((current) => Array.from(new Set([...current, id])));
    setPopId(id);
    window.setTimeout(() => setPopId((current) => (current === id ? null : current)), 180);
    setAnswers((list) =>
      list.map((item) =>
        item.id === id ? { ...item, likeCount: item.likeCount + 1 } : item,
      ),
    );
    const next = await likeDailyAnswer(id, clientId);
    if (next == null) return;
    setAnswers((list) =>
      list.map((item) => (item.id === id ? { ...item, likeCount: next } : item)),
    );
  }

  const visible = answers.filter((item) => !item.isHidden);
  const cooling = waitMs > 0;
  const locked = busy || cooling;
  const showHiddenBanner = ownHidden;

  return (
    <section className="rounded-3xl border-2 border-[var(--text-headline)]/15 bg-[var(--card-surface)] p-5 shadow-[0_5px_0_0_rgba(0,0,0,0.06)]">
      <p className="text-xs font-black uppercase tracking-wider text-[var(--text-headline)]/60">
        {copy.kicker}
      </p>
      {question ? (
        <h2 className="mt-1 font-sans text-lg font-black leading-snug text-[var(--text-headline)]">
          {question.prompt}
        </h2>
      ) : (
        <p className="mt-2 font-sans text-sm font-medium text-[var(--text-body)]">
          {copy.noQuestion}
        </p>
      )}

      {question ? (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <div className="flex items-start gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{copy.placeholder}</span>
              <input
                value={draft}
                maxLength={GOSSIP_MAX_CHARS}
                disabled={locked}
                onChange={(event) => {
                  setDraft(event.target.value.slice(0, GOSSIP_MAX_CHARS));
                  setNotice(null);
                }}
                placeholder={copy.placeholder}
                className="w-full rounded-2xl border border-[var(--text-headline)]/15 bg-[var(--bg-canvas)] px-4 py-2.5 font-sans text-sm font-medium text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)]/50 focus:border-[var(--btn-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="mt-1 block text-right font-sans text-[10px] font-bold tabular-nums text-[var(--text-body)]/50">
                {copy.counter
                  .replace("{used}", String(draft.length))
                  .replace("{max}", String(GOSSIP_MAX_CHARS))}
              </span>
            </label>
            <button
              type="submit"
              disabled={locked || !draft.trim()}
              className="rounded-2xl bg-[var(--btn-primary)] px-5 py-2.5 font-sans text-sm font-extrabold text-[var(--btn-text)] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copy.send}
            </button>
          </div>
          {showHiddenBanner ? (
            <p className="mt-3 rounded-2xl border border-red-400/35 bg-neutral-200/80 px-3 py-2.5 text-center font-sans text-xs font-semibold leading-snug text-red-800/75">
              {copy.hiddenOwn.replace("{time}", formatGossipClock(waitMs))}
            </p>
          ) : notice ? (
            <p className="mt-2 font-sans text-xs font-semibold text-red-600">{notice}</p>
          ) : cooling ? (
            <p className="mt-2 font-sans text-xs font-medium text-[var(--text-body)]">
              {copy.wait}
            </p>
          ) : null}
        </form>
      ) : null}

      {question ? (
        <div className="mt-4 space-y-2">
          {visible.length === 0 ? (
            <p className="px-3 py-6 text-center font-sans text-sm font-medium leading-relaxed text-[var(--text-body)]">
              {copy.empty}
            </p>
          ) : (
            visible.map((item) => {
              const isLiked = liked.includes(item.id);
              return (
                <article
                  key={item.id}
                  className="flex items-center gap-2 rounded-2xl border border-[var(--text-headline)]/10 bg-[var(--bg-canvas)] px-3 py-2.5"
                >
                  <span className="shrink-0 rounded-full bg-[var(--btn-primary)] px-2 py-0.5 font-sans text-[10px] font-extrabold text-[var(--btn-text)]">
                    {item.authorLabel}
                  </span>
                  <p className="min-w-0 flex-1 font-sans text-sm font-medium leading-snug text-[var(--text-headline)]">
                    {item.body}
                  </p>
                  <button
                    type="button"
                    aria-label={isLiked ? copy.liked : copy.like}
                    onClick={() => void like(item.id)}
                    className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 text-[var(--text-headline)] transition-transform duration-150 ${
                      popId === item.id ? "scale-125" : "scale-100"
                    }`}
                  >
                    <HeartIcon filled={isLiked} />
                    <span className="font-sans text-[11px] font-bold tabular-nums">
                      {item.likeCount}
                    </span>
                  </button>
                </article>
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        d="M12.1 20.3s-6.7-4.2-9.2-8.1C1 9.4 1.6 5.8 4.7 4.6c2.2-.9 4.4.1 5.6 1.9 1.2-1.8 3.4-2.8 5.6-1.9 3.1 1.2 3.7 4.8 1.8 7.6-2.5 3.9-9.2 8.1-9.2 8.1Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
