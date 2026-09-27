"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { RotateCcw } from "lucide-react";
import { BlockBlastGame } from "@/components/BlockBlastGame";
import { useDuel } from "@/components/DuelProvider";
import { PhoneShell } from "@/components/PhoneShell";
import { usePlayReward } from "@/components/PlayRewardProvider";
import { TabooGame } from "@/components/TabooGame";
import { WhoAmIGame } from "@/components/WhoAmIGame";
import { tenantConfig } from "@/config/tenant.config";
import { clearArcadeGameSession } from "@/lib/arcadeSession";
import { beginPlaySession, endPlaySession, formatPlayClock } from "@/lib/playReward";
import {
  endVenueTableGame,
  getActiveTableLabel,
  startVenueTableGame,
} from "@/lib/tableSession";
import { writeVenueHomeView } from "@/lib/venueHome";

type ActiveGameId = "taboo" | "whoami" | "blockblast";

type GameContainerProps = {
  title: string;
  onBack: () => void;
  children?: ReactNode;
  overlay?: boolean;
  containerRef?: RefObject<HTMLDivElement | null>;
  activeGame?: ActiveGameId;
  /** Soft game key written to table_sessions for admin live view. */
  sessionGame?: string;
};

export function GameContainer({
  title,
  onBack,
  children,
  overlay = false,
  containerRef,
  activeGame,
  sessionGame,
}: GameContainerProps) {
  const shell = tenantConfig.copy.landing.gameShell;
  const { tenantId, player } = useDuel();
  const table = getActiveTableLabel(tenantId) || shell.tableFallback;
  const rewardCopy = tenantConfig.copy.playReward;
  const { elapsedSeconds, progress, isUnlocked, redeemedAt, openClaim } = usePlayReward();
  const clock = formatPlayClock(elapsedSeconds);
  const rewardReady = isUnlocked && !redeemedAt;
  const [mounted, setMounted] = useState(false);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    beginPlaySession();
    const gameType = sessionGame ?? activeGame ?? "arcade";
    void startVenueTableGame({
      tenantId,
      clientId: player.clientId,
      gameType,
    });
    return () => {
      endPlaySession();
      void endVenueTableGame({ tenantId, clientId: player.clientId });
    };
  }, [activeGame, player.clientId, sessionGame, tenantId]);

  function wipeActiveGame() {
    if (
      activeGame === "taboo" ||
      activeGame === "whoami" ||
      activeGame === "blockblast"
    ) {
      clearArcadeGameSession(activeGame, tenantId);
    }
  }

  function handleBack() {
    wipeActiveGame();
    writeVenueHomeView(tenantId, "lobby");
    onBack();
  }

  function handleReset() {
    wipeActiveGame();
    setSessionEpoch((value) => value + 1);
  }

  return (
    <div
      ref={containerRef}
      className={overlay ? "fixed inset-0 z-[80]" : undefined}
    >
      <PhoneShell>
        <header className="grid w-full shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-[var(--border)] px-3 py-1.5 sm:px-4 sm:py-2">
          <button
            type="button"
            onClick={handleBack}
            className="flex min-h-12 max-w-full items-center justify-self-start rounded-full py-2 pr-1 text-left font-sans text-sm font-bold text-[var(--text-body)] active:scale-95"
          >
            <span className="truncate">{shell.back}</span>
          </button>
          <h1 className="max-w-[9rem] truncate text-center font-sans text-base font-black tracking-tight text-[var(--text-headline)] sm:max-w-none sm:text-lg">
            {title}
          </h1>
          <div className="flex min-w-0 items-center justify-end gap-1.5 justify-self-end">
            {activeGame ? (
              <button
                type="button"
                onClick={handleReset}
                aria-label={shell.resetShort}
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-surface)] text-[var(--text-headline)] active:scale-95"
              >
                <RotateCcw className="size-3.5 shrink-0" aria-hidden />
              </button>
            ) : null}
            <div className="flex items-center gap-1.5">
              <AnalogFillClock
                progress={mounted ? progress : 0}
                label={mounted ? clock : "00:00"}
              />
              <div className="text-right">
                <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-body)]">
                  {table}
                </p>
                <p
                  suppressHydrationWarning
                  className="font-sans text-sm font-semibold tabular-nums text-[var(--text-headline)]"
                >
                  {mounted ? clock : "00:00"}
                </p>
              </div>
            </div>
          </div>
        </header>
        {rewardReady ? (
          <div
            className={`flex items-center justify-between border-b border-[var(--border)] bg-[var(--btn-primary)] ${
              activeGame === "blockblast" ? "gap-2 px-3 py-1" : "gap-3 px-3 py-2"
            }`}
          >
            <p
              className={`min-w-0 font-bold text-[var(--btn-text)] ${
                activeGame === "blockblast" ? "text-xs leading-tight" : "text-sm"
              }`}
            >
              {rewardCopy.readyNotice}
            </p>
            <button
              type="button"
              onClick={openClaim}
              className={`inline-flex shrink-0 items-center rounded-xl bg-[var(--bg-canvas)] font-sans font-bold text-[var(--text-headline)] transition hover:brightness-95 active:scale-95 ${
                activeGame === "blockblast"
                  ? "min-h-8 px-3 py-1 text-[11px]"
                  : "min-h-12 px-4 text-xs"
              }`}
            >
              {rewardCopy.readyOpen}
            </button>
          </div>
        ) : null}
        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-hidden ${
            activeGame === "blockblast" ? "p-0" : "px-3 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-3"
          }`}
        >
          {activeGame === "taboo" ? (
            <TabooGame key={sessionEpoch} />
          ) : activeGame === "whoami" ? (
            <WhoAmIGame key={sessionEpoch} />
          ) : activeGame === "blockblast" ? (
            <BlockBlastGame
              key={sessionEpoch}
              onBack={handleBack}
              onReset={handleReset}
            />
          ) : (
            children
          )}
        </div>
      </PhoneShell>
    </div>
  );
}

function AnalogFillClock({
  progress,
  label,
}: {
  progress: number;
  label: string;
}) {
  const amount = Math.min(1, Math.max(0, progress));
  const radius = 14;
  const startX = 22;
  const startY = 22 - radius;
  const angle = amount * Math.PI * 2 - Math.PI / 2;
  const endX = 22 + radius * Math.cos(angle);
  const endY = 22 + radius * Math.sin(angle);
  const large = amount > 0.5 ? 1 : 0;
  const wedge =
    amount >= 0.999
      ? ""
      : `M 22 22 L ${startX} ${startY} A ${radius} ${radius} 0 ${large} 1 ${endX} ${endY} Z`;

  return (
    <svg
      viewBox="0 0 44 44"
      className="size-11 shrink-0"
      role="img"
      aria-label={label}
    >
      <circle
        cx="22"
        cy="22"
        r="18"
        className="fill-[var(--card-surface)] stroke-[var(--border)]"
        strokeWidth="2"
      />
      {amount >= 0.999 ? (
        <circle cx="22" cy="22" r={radius} className="fill-[var(--btn-primary)]" />
      ) : amount > 0 ? (
        <path d={wedge} className="fill-[var(--btn-primary)]" />
      ) : null}
      <line
        x1="22"
        y1="8"
        x2="22"
        y2="12"
        className="stroke-[var(--text-headline)]"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="32"
        x2="22"
        y2="36"
        className="stroke-[var(--text-headline)]"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="22"
        x2="12"
        y2="22"
        className="stroke-[var(--text-headline)]"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="22"
        x2="36"
        y2="22"
        className="stroke-[var(--text-headline)]"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="22"
        x2="22"
        y2="11"
        className="stroke-[var(--text-headline)]"
        strokeWidth="2"
        strokeLinecap="round"
        transform={`rotate(${amount * 360} 22 22)`}
      />
      <circle cx="22" cy="22" r="2.2" className="fill-[var(--text-headline)]" />
    </svg>
  );
}
