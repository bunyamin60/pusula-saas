"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayReward } from "@/components/PlayRewardProvider";
import { tenantConfig } from "@/config/tenant.config";
import { formatPlayClock } from "@/lib/playReward";

type RewardProgressBarProps = {
  compact?: boolean;
  embedded?: boolean;
};

export function RewardProgressBar({
  compact = false,
  embedded = false,
}: RewardProgressBarProps) {
  const copy = tenantConfig.copy.playReward;
  const {
    progress,
    elapsedSeconds,
    isUnlocked,
    isPaused,
    clockLabel,
    pausedLabel,
    openClaim,
  } = usePlayReward();
  const wasUnlocked = useRef(isUnlocked);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!isUnlocked || wasUnlocked.current) {
      wasUnlocked.current = isUnlocked;
      return;
    }
    wasUnlocked.current = true;
    setBurst(true);
    try {
      navigator.vibrate?.([...tenantConfig.playReward.vibrate]);
    } catch {
      // Vibration is optional on desktop and blocked contexts.
    }
    const hide = window.setTimeout(() => setBurst(false), 1400);
    return () => window.clearTimeout(hide);
  }, [isUnlocked]);

  const fill = `${Math.round(progress * 1000) / 10}%`;
  const elapsedClock = formatPlayClock(elapsedSeconds);

  const shellClass = embedded
    ? "relative mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-canvas)] p-2.5"
    : compact
      ? "relative mb-3 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-canvas)] p-2.5 shadow-sm"
      : "relative mb-3 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2";

  if (isUnlocked) {
    const readyBar = (
      <div
        className={
          embedded || compact
            ? "relative mt-0 mb-3 flex items-center justify-between rounded-2xl bg-[var(--btn-primary)] p-3"
            : "relative mb-3 flex items-center justify-between rounded-2xl bg-[var(--btn-primary)] p-3 shadow-md"
        }
      >
        {burst ? <ConfettiBurst /> : null}
        <p className="min-w-0 truncate pr-3 font-sans text-sm font-bold text-[var(--btn-text)]">
          {compact || embedded ? copy.readyCtaShort : copy.readyCta}
        </p>
        <button
          type="button"
          onClick={openClaim}
          className="shrink-0 rounded-xl bg-[var(--bg-canvas)] px-3 py-2 font-sans text-xs font-bold text-[var(--text-headline)] transition hover:brightness-95 active:scale-95"
        >
          {copy.readyOpen}
        </button>
      </div>
    );
    return readyBar;
  }

  if (compact || embedded) {
    return (
      <div className={shellClass}>
        <div className="flex items-center gap-2.5">
          <p className="min-w-0 flex-1 truncate text-left font-sans text-[11px] font-medium tracking-wide text-[var(--text-body)]">
            {copy.barLabel}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--text-headline)]/10">
              <div
                className="h-full rounded-full bg-[var(--btn-primary)] transition-[width] duration-500 ease-out"
                style={{
                  width: fill,
                  opacity: isPaused ? 0.55 : 1,
                }}
              />
            </div>
            <p
              suppressHydrationWarning
              className="font-sans text-[11px] font-semibold tabular-nums text-[var(--text-headline)]"
            >
              {elapsedClock}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-sans text-[11px] font-medium tracking-wide text-[var(--text-body)]">
          {isPaused ? pausedLabel : copy.barLabel}
        </p>
        <p className="shrink-0 font-sans text-xs font-semibold tabular-nums text-[var(--text-headline)]">
          {clockLabel}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--text-headline)]/10">
        <div
          className="h-full rounded-full bg-[var(--btn-primary)] transition-[width] duration-500 ease-out"
          style={{ width: fill }}
        />
      </div>
    </div>
  );
}

function ConfettiBurst() {
  return (
    <div className="play-reward-confetti pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
      {Array.from({ length: 14 }, (_, index) => (
        <span key={index} className="play-reward-confetti-piece" />
      ))}
    </div>
  );
}
