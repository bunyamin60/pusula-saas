"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayReward } from "@/components/PlayRewardProvider";
import { tenantConfig } from "@/config/tenant.config";
import { formatPlayClock } from "@/lib/playReward";

type RewardProgressBarProps = {
  compact?: boolean;
};

export function RewardProgressBar({ compact = false }: RewardProgressBarProps) {
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

  if (isUnlocked) {
    return (
      <>
        <div className="h-16 shrink-0" aria-hidden />
        <div className="fixed top-3 inset-x-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-primary/95 p-3 shadow-md backdrop-blur-md">
          {burst ? <ConfettiBurst /> : null}
          <p className="min-w-0 truncate pr-3 font-sans text-sm font-bold text-on-primary">
            {compact ? copy.readyCtaShort : copy.readyCta}
          </p>
          <button
            type="button"
            onClick={openClaim}
            className="shrink-0 rounded-xl bg-ink px-3 py-2 font-sans text-xs font-bold text-background transition hover:opacity-90 active:scale-95"
          >
            {copy.readyOpen}
          </button>
        </div>
      </>
    );
  }

  if (compact) {
    return (
      <div className="relative mb-3 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-background/80 p-2.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <p className="min-w-0 flex-1 truncate font-sans text-[11px] font-medium tracking-wide text-muted">
            {copy.barLabel}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: fill,
                  background: "var(--btn-primary)",
                  opacity: isPaused ? 0.55 : 1,
                }}
              />
            </div>
            <p
              suppressHydrationWarning
              className="font-sans text-[11px] font-semibold tabular-nums text-ink"
            >
              {elapsedClock}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-3 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-background/80 px-3 py-2">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-sans text-[11px] font-medium tracking-wide text-muted">
          {isPaused ? pausedLabel : copy.barLabel}
        </p>
        <p className="shrink-0 font-sans text-xs font-semibold tabular-nums text-ink">
          {clockLabel}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: fill, background: "var(--btn-primary)" }}
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
