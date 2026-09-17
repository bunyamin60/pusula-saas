"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  tenantConfig,
  type TalkCategoryId,
  type TalkFlagVote,
  type TalkPrompt,
} from "@/config/tenant.config";
import { talkPromptsOf } from "@/lib/campaignState";
import { useCampaign } from "@/lib/useCampaign";

type TalkDeckProps = {
  categoryId: string;
  index: number;
  answers: Record<string, string>;
  votes: Record<string, TalkFlagVote>;
  onIndex: (index: number) => void;
  onAnswer: (promptId: string, text: string) => void;
  onVote: (promptId: string, vote: TalkFlagVote) => void;
  onHome: () => void;
  onPickMood: () => void;
  onClaim: () => void;
  onChooseCategory?: (categoryId: TalkCategoryId) => void;
  showModes?: boolean;
};

type PlayItem =
  | { type: "prompt"; prompt: TalkPrompt }
  | { type: "surprise" }
  | { type: "end" };

export function TalkDeck({
  categoryId,
  index,
  answers,
  votes,
  onIndex,
  onAnswer,
  onVote,
  onHome: _onHome,
  onPickMood,
  onClaim,
  onChooseCategory,
  showModes = false,
}: TalkDeckProps) {
  const copy = tenantConfig.copy.talk;
  const campaign = useCampaign();
  const category = campaign.talkCategories.find((item) => item.id === categoryId);
  const prompts = useMemo(
    () => talkPromptsOf(campaign.talkCategories, categoryId),
    [campaign.talkCategories, categoryId],
  );
  const playlist = useMemo(
    () => buildPlaylist(prompts, tenantConfig.talk.surpriseAfter),
    [prompts],
  );

  const safeIndex = Math.min(index, Math.max(playlist.length - 1, 0));
  const item = playlist[safeIndex];
  const isFlag = item?.type === "prompt" && item.prompt.kind === "redflag";
  const isWrite = item?.type === "prompt" && item.prompt.kind === "write";
  const [dragX, setDragX] = useState(0);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const canSwipe = Boolean(item && item.type === "prompt" && !isWrite);

  useEffect(() => {
    if (index !== safeIndex) onIndex(safeIndex);
  }, [index, onIndex, safeIndex]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const onMove = (event: PointerEvent) => {
      if (!dragging.current || !canSwipe) return;
      const dx = event.clientX - startX.current;
      const dy = event.clientY - startY.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        event.preventDefault();
        setDragX(dx);
      }
    };

    node.addEventListener("pointermove", onMove, { passive: false });
    return () => node.removeEventListener("pointermove", onMove);
  }, [canSwipe]);

  function go(next: number, dir?: "left" | "right") {
    if (leaving || next < 0 || next >= playlist.length) return;
    setLeaving(dir ?? (next > safeIndex ? "left" : "right"));
    window.setTimeout(() => {
      onIndex(next);
      setDragX(0);
      setLeaving(null);
    }, 420);
  }

  function voteAndGo(vote: TalkFlagVote) {
    if (item?.type !== "prompt" || item.prompt.kind !== "redflag") return;
    onVote(item.prompt.id, vote);
    go(safeIndex + 1, vote === "red" ? "left" : "right");
  }

  function finishDrag() {
    dragging.current = false;
    if (!canSwipe || item?.type !== "prompt") {
      setDragX(0);
      return;
    }
    if (isFlag) {
      if (dragX <= -64) voteAndGo("red");
      else if (dragX >= 64) voteAndGo("green");
      else setDragX(0);
      return;
    }
    if (dragX <= -64) go(safeIndex + 1, "left");
    else if (dragX >= 64) go(safeIndex - 1, "right");
    else setDragX(0);
  }

  if (!category || !item) {
    return <section className="flex flex-1 flex-col" />;
  }

  const progress = copy.progress
    .replace("{current}", String(safeIndex + 1))
    .replace("{total}", String(playlist.length));
  const redGlow = leaving === "left" ? 1 : Math.min(1, Math.max(0, (-dragX - 12) / 72));
  const greenGlow = leaving === "right" ? 1 : Math.min(1, Math.max(0, (dragX - 12) / 72));
  const tabLabels = copy.tabs as Record<string, string>;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none">
      <div className="flex shrink-0 items-center justify-end gap-3">
        <p className="text-xs font-bold text-[var(--text-body)]">{progress}</p>
      </div>
      {showModes ? (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {campaign.talkCategories.map((item) => {
            const active = item.id === categoryId;
            const label = tabLabels[item.id] ?? item.title;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChooseCategory?.(item.id)}
                className={`min-h-12 rounded-xl px-1.5 py-2 text-center font-sans text-[11px] leading-tight tracking-wide transition-colors select-none active:scale-95 ${
                  active
                    ? "bg-[var(--btn-primary)] font-extrabold text-[var(--btn-text)] shadow-sm"
                    : "bg-white/10 font-semibold text-[var(--text-headline)]/80 hover:bg-white/15"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-body)]">
          {tabLabels[category.id] ?? category.title}
        </p>
      )}

      <div
        ref={stageRef}
        className="talk-stage relative mt-4 min-h-0 flex-1 pb-6"
        onPointerDown={(event) => {
          if (!canSwipe) return;
          startX.current = event.clientX;
          startY.current = event.clientY;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div
          aria-hidden
          className="talk-card-peek talk-card-peek-2"
        />
        <div
          aria-hidden
          className="talk-card-peek talk-card-peek-1"
        />
        <article
          key={item.type === "prompt" ? item.prompt.id : `${item.type}-${safeIndex}`}
          className={`talk-card relative z-10 overflow-hidden ${leaving === "left" ? "talk-card-out-left" : ""} ${leaving === "right" ? "talk-card-out-right" : ""}`}
          style={
            leaving
              ? undefined
              : { transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)` }
          }
        >
          {canSwipe ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 bg-red-500/10 transition-opacity duration-150"
                style={{ opacity: redGlow }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 bg-emerald-500/10 transition-opacity duration-150"
                style={{ opacity: greenGlow }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-3 left-3 z-20 rounded-lg bg-red-500 px-2 py-1 font-sans text-[10px] font-bold tracking-[0.14em] text-white shadow-sm"
                style={{ opacity: redGlow }}
              >
                {copy.swipeRed}
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute top-3 right-3 z-20 rounded-lg bg-emerald-500 px-2 py-1 font-sans text-[10px] font-bold tracking-[0.14em] text-white shadow-sm"
                style={{ opacity: greenGlow }}
              >
                {copy.swipePass}
              </span>
            </>
          ) : null}
          {item.type === "prompt" && item.prompt.kind === "write" ? (
            <WriteFace
              prompt={item.prompt}
              value={answers[item.prompt.id] ?? ""}
              onChange={(text) => onAnswer(item.prompt.id, text)}
            />
          ) : null}
          {item.type === "prompt" && item.prompt.kind === "redflag" ? (
            <FlagFace prompt={item.prompt} vote={votes[item.prompt.id]} />
          ) : null}
          {item.type === "surprise" ? (
            <SurpriseFace onClaim={onClaim} onSkip={() => go(safeIndex + 1)} />
          ) : null}
          {item.type === "end" ? (
            <EndFace
              prompts={prompts}
              answers={answers}
              votes={votes}
              onAgain={() => go(0)}
              onPickMood={onPickMood}
            />
          ) : null}
        </article>
      </div>

      {item.type === "prompt" && item.prompt.kind === "write" ? (
        <div className="mt-3 flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => go(safeIndex - 1)}
            disabled={safeIndex === 0 || Boolean(leaving)}
            className="btn-secondary min-h-14 flex-1 disabled:opacity-40"
          >
            {copy.prev}
          </button>
          <button
            type="button"
            onClick={() => go(safeIndex + 1)}
            disabled={Boolean(leaving)}
            className="btn-primary min-h-14 flex-[1.4]"
          >
            {copy.next}
          </button>
        </div>
      ) : null}

      {item.type === "prompt" && item.prompt.kind === "redflag" ? (
        <div className="mt-3 flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => voteAndGo("red")}
            disabled={Boolean(leaving)}
            className="flex-1 rounded-2xl border border-rose-200 bg-rose-50 py-3.5 font-sans text-sm font-bold text-rose-700 transition active:scale-95 disabled:opacity-40"
          >
            {copy.flagLeft}
          </button>
          <button
            type="button"
            onClick={() => voteAndGo("green")}
            disabled={Boolean(leaving)}
            className="flex-1 rounded-2xl border border-emerald-200 bg-emerald-50 py-3.5 font-sans text-sm font-bold text-emerald-800 transition active:scale-95 disabled:opacity-40"
          >
            {copy.flagRight}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function WriteFace({
  prompt,
  value,
  onChange,
}: {
  prompt: TalkPrompt;
  value: string;
  onChange: (text: string) => void;
}) {
  const copy = tenantConfig.copy.talk;
  const [draft, setDraft] = useState(value);
  const [locked, setLocked] = useState(Boolean(value.trim()));

  useEffect(() => {
    setDraft(value);
    setLocked(Boolean(value.trim()));
  }, [prompt.id, value]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      <p className="font-sans text-xl font-black leading-snug text-[var(--text-headline)]">
        {prompt.text}
      </p>
      <p className="mt-2 text-xs font-medium text-[var(--text-body)] opacity-90">{copy.writeHint}</p>
      {locked ? (
        <div className="mt-4 rounded-2xl border-2 border-[var(--border)] bg-black/25 px-4 py-3">
          <p className="font-sans text-sm font-medium leading-relaxed text-[var(--text-headline)]">{value}</p>
          <p className="mt-2 text-xs font-medium text-[var(--text-body)] opacity-90">{copy.writeSaved}</p>
          <button
            type="button"
            onClick={() => setLocked(false)}
            className="mt-2 rounded-full bg-[var(--btn-primary)] px-3 py-1 font-sans text-xs font-bold text-[var(--btn-text)]"
          >
            {copy.writeEdit}
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={copy.writePlaceholder}
            rows={4}
            className="mt-4 min-h-[7.5rem] resize-none rounded-2xl border-2 border-[var(--border)] bg-black/25 p-4 text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)]/50 focus:border-[var(--btn-primary)]"
          />
          <button
            type="button"
            onClick={() => {
              onChange(draft.trim());
              setLocked(Boolean(draft.trim()));
            }}
            className="btn-primary mt-3 min-h-12 w-full"
          >
            {copy.writeSave}
          </button>
        </>
      )}
    </div>
  );
}

function FlagFace({
  prompt,
  vote,
}: {
  prompt: TalkPrompt;
  vote?: TalkFlagVote;
}) {
  const copy = tenantConfig.copy.talk;
  return (
    <div className="relative z-[15] flex h-full flex-col pt-6">
      <p className="font-sans text-xl font-black leading-snug text-[var(--text-headline)]">
        {prompt.text}
      </p>
      <p className="mt-3 text-xs font-medium text-[var(--text-body)] opacity-90">{copy.flagHint}</p>
      {vote ? (
        <p
          className="mt-auto text-center text-sm font-semibold"
          style={{
            color:
              vote === "red"
                ? tenantConfig.talk.flagRed
                : tenantConfig.talk.flagGreen,
          }}
        >
          {vote === "red" ? copy.flagLeft : copy.flagRight}
        </p>
      ) : (
        <p className="mt-auto text-center text-xs font-medium tracking-wide text-[var(--text-body)] opacity-90">
          {copy.flagHint}
        </p>
      )}
    </div>
  );
}

function SurpriseFace({
  onClaim,
  onSkip,
}: {
  onClaim: () => void;
  onSkip: () => void;
}) {
  const copy = tenantConfig.copy.talk;
  return (
    <div className="flex h-full flex-col">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-body)]">
        {copy.surpriseEyebrow}
      </p>
      <h3 className="mt-3 font-sans text-xl font-black leading-snug text-[var(--text-headline)]">
        {copy.surpriseTitle}
      </h3>
      <p className="mt-3 text-xs font-medium leading-relaxed text-[var(--text-body)] opacity-90">{copy.surpriseBody}</p>
      <div className="mt-auto space-y-2 pt-8">
        <button type="button" onClick={onClaim} className="btn-primary min-h-14 w-full">
          {copy.surpriseCta}
        </button>
        <button type="button" onClick={onSkip} className="btn-secondary min-h-14 w-full">
          {copy.surpriseSkip}
        </button>
      </div>
    </div>
  );
}

function EndFace({
  prompts,
  answers,
  votes,
  onAgain,
  onPickMood,
}: {
  prompts: TalkPrompt[];
  answers: Record<string, string>;
  votes: Record<string, TalkFlagVote>;
  onAgain: () => void;
  onPickMood: () => void;
}) {
  const copy = tenantConfig.copy.talk;
  const writes = prompts.filter((prompt) => prompt.kind === "write");
  const flags = prompts.filter((prompt) => prompt.kind === "redflag");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      <h3 className="font-sans text-xl font-black leading-snug text-[var(--text-headline)]">
        {copy.compareTitle}
      </h3>
      <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--text-body)] opacity-90">{copy.compareLead}</p>

      {writes.length ? (
        <div className="mt-4 space-y-2">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {copy.compareWrites}
          </p>
          {writes.map((prompt) => (
            <div key={prompt.id} className="rounded-2xl border-2 border-[var(--border)] bg-black/25 px-3 py-3">
              <p className="text-xs font-medium text-[var(--text-body)] opacity-90">{prompt.text}</p>
              <p className="mt-1 font-sans text-sm font-medium text-[var(--text-headline)]">
                {answers[prompt.id]?.trim() || copy.emptyAnswer}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {flags.length ? (
        <div className="mt-4 space-y-2">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {copy.compareFlags}
          </p>
          {flags.map((prompt) => {
            const vote = votes[prompt.id];
            return (
              <div key={prompt.id} className="flex items-start justify-between gap-3 rounded-2xl border-2 border-[var(--border)] bg-black/25 px-3 py-3">
                <p className="font-sans text-sm font-medium text-[var(--text-headline)]">{prompt.text}</p>
                <span
                  className="shrink-0 text-xs font-bold"
                  style={{
                    color:
                      vote === "red"
                        ? tenantConfig.talk.flagRed
                        : vote === "green"
                          ? tenantConfig.talk.flagGreen
                          : undefined,
                  }}
                >
                  {vote === "red"
                    ? copy.compareRed
                    : vote === "green"
                      ? copy.compareGreen
                      : copy.emptyAnswer}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="mt-4 text-xs font-medium text-[var(--text-body)] opacity-90">{copy.endBody}</p>
      <div className="mt-auto space-y-2 pt-6">
        <button type="button" onClick={onAgain} className="btn-primary min-h-14 w-full">
          {copy.again}
        </button>
        <button type="button" onClick={onPickMood} className="btn-secondary min-h-14 w-full">
          {copy.otherMood}
        </button>
      </div>
    </div>
  );
}

function buildPlaylist(prompts: TalkPrompt[], surpriseAfter: number): PlayItem[] {
  const items: PlayItem[] = prompts.map((prompt) => ({ type: "prompt", prompt }));
  if (items.length === 0) return [{ type: "end" }];
  const insertAt = Math.min(Math.max(surpriseAfter, 1), items.length);
  items.splice(insertAt, 0, { type: "surprise" });
  items.push({ type: "end" });
  return items;
}
