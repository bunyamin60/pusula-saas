"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceBack } from "@/components/ExperienceBack";
import {
  tenantConfig,
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
  onHome,
  onPickMood,
  onClaim,
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

  useEffect(() => {
    if (index !== safeIndex) onIndex(safeIndex);
  }, [index, onIndex, safeIndex]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const onMove = (event: TouchEvent) => {
      if (!dragging.current || isWrite) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        event.preventDefault();
        setDragX(dx);
      }
    };

    node.addEventListener("touchmove", onMove, { passive: false });
    return () => node.removeEventListener("touchmove", onMove);
  }, [isWrite]);

  function go(next: number, dir?: "left" | "right") {
    if (leaving || next < 0 || next >= playlist.length) return;
    setLeaving(dir ?? (next > safeIndex ? "left" : "right"));
    window.setTimeout(() => {
      onIndex(next);
      setDragX(0);
      setLeaving(null);
    }, 280);
  }

  function voteAndGo(vote: TalkFlagVote) {
    if (item?.type !== "prompt" || item.prompt.kind !== "redflag") return;
    onVote(item.prompt.id, vote);
    go(safeIndex + 1, vote === "red" ? "left" : "right");
  }

  function finishDrag() {
    dragging.current = false;
    if (isWrite || item?.type !== "prompt") {
      setDragX(0);
      return;
    }
    if (isFlag) {
      if (dragX <= -64) voteAndGo("red");
      else if (dragX >= 64) voteAndGo("green");
      else setDragX(0);
      return;
    }
    setDragX(0);
  }

  if (!category || !item) {
    return (
      <section className="flex flex-1 flex-col">
        <ExperienceBack onBack={onHome} />
      </section>
    );
  }

  const progress = copy.progress
    .replace("{current}", String(safeIndex + 1))
    .replace("{total}", String(playlist.length));
  const flagTint =
    isFlag && !leaving
      ? dragX < -20
        ? tenantConfig.talk.flagRed
        : dragX > 20
          ? tenantConfig.talk.flagGreen
          : ""
      : "";

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <ExperienceBack onBack={onHome} />
        <p className="text-xs text-muted">{progress}</p>
      </div>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
        {category.title}
      </p>

      <div
        ref={stageRef}
        className="talk-stage relative mt-4 min-h-0 flex-1"
        onTouchStart={(event) => {
          if (isWrite) return;
          startX.current = event.touches[0].clientX;
          startY.current = event.touches[0].clientY;
          dragging.current = true;
        }}
        onTouchEnd={finishDrag}
        onTouchCancel={finishDrag}
      >
        <article
          className={`talk-card ${leaving === "left" ? "talk-card-out-left" : ""} ${leaving === "right" ? "talk-card-out-right" : ""}`}
          style={{
            ...(leaving
              ? undefined
              : { transform: `translateX(${dragX}px) rotate(${dragX / 48}deg)` }),
            ...(flagTint
              ? {
                  boxShadow: `inset 0 0 0 3px ${flagTint}`,
                  background: `color-mix(in srgb, ${flagTint} 16%, var(--surface))`,
                }
              : {}),
          }}
        >
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
            className="flex min-h-14 flex-1 items-center justify-center rounded-2xl text-sm font-bold text-white"
            style={{ backgroundColor: tenantConfig.talk.flagRed }}
          >
            ← {copy.flagLeft}
          </button>
          <button
            type="button"
            onClick={() => voteAndGo("green")}
            disabled={Boolean(leaving)}
            className="flex min-h-14 flex-1 items-center justify-center rounded-2xl text-sm font-bold text-white"
            style={{ backgroundColor: tenantConfig.talk.flagGreen }}
          >
            {copy.flagRight} →
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
      <p className="font-display text-[1.45rem] leading-snug text-ink">
        {prompt.text}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{copy.writeHint}</p>
      {locked ? (
        <div className="mt-4 rounded-2xl bg-background px-4 py-3">
          <p className="text-sm leading-relaxed text-ink">{value}</p>
          <p className="mt-2 text-xs text-primary">{copy.writeSaved}</p>
          <button
            type="button"
            onClick={() => setLocked(false)}
            className="mt-2 text-xs text-muted underline decoration-primary/30 underline-offset-4"
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
            className="field-input mt-4 min-h-[7.5rem] resize-none text-base"
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
    <div className="flex h-full flex-col">
      <p className="font-display text-[1.55rem] leading-snug text-ink">
        {prompt.text}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted">{copy.flagHint}</p>
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
        <p className="mt-auto text-center text-xs tracking-wide text-muted">
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
        {copy.surpriseEyebrow}
      </p>
      <h3 className="mt-3 font-display text-[1.65rem] leading-tight text-ink">
        {copy.surpriseTitle}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{copy.surpriseBody}</p>
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
      <h3 className="font-display text-[1.55rem] leading-tight text-ink">
        {copy.compareTitle}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{copy.compareLead}</p>

      {writes.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {copy.compareWrites}
          </p>
          {writes.map((prompt) => (
            <div key={prompt.id} className="rounded-2xl bg-background px-3 py-3">
              <p className="text-xs text-muted">{prompt.text}</p>
              <p className="mt-1 text-sm text-ink">
                {answers[prompt.id]?.trim() || copy.emptyAnswer}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {flags.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {copy.compareFlags}
          </p>
          {flags.map((prompt) => {
            const vote = votes[prompt.id];
            return (
              <div key={prompt.id} className="flex items-start justify-between gap-3 rounded-2xl bg-background px-3 py-3">
                <p className="text-sm text-ink">{prompt.text}</p>
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

      <p className="mt-4 text-sm text-muted">{copy.endBody}</p>
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
