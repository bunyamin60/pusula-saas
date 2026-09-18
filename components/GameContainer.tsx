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

type ActiveGameId = "taboo" | "whoami" | "blockblast";

type GameContainerProps = {
  title: string;
  onBack: () => void;
  children?: ReactNode;
  overlay?: boolean;
  containerRef?: RefObject<HTMLDivElement | null>;
  activeGame?: ActiveGameId;
};

export function GameContainer({
  title,
  onBack,
  children,
  overlay = false,
  containerRef,
  activeGame,
}: GameContainerProps) {
  const shell = tenantConfig.copy.landing.gameShell;
  const table =
    tenantConfig.brand.tableName.trim() || shell.tableFallback;
  const { tenantId } = useDuel();
  const { elapsedSeconds } = usePlayReward();
  const clock = formatPlayClock(elapsedSeconds);
  const [mounted, setMounted] = useState(false);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    beginPlaySession();
    return () => endPlaySession();
  }, []);

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
        <header className="flex w-full shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2">
          <button
            type="button"
            onClick={handleBack}
            className="flex min-h-12 max-w-[9.5rem] shrink-0 items-center gap-1.5 rounded-full py-2 text-left font-sans text-sm font-bold text-[var(--text-body)] active:scale-95"
          >
            {shell.back}
          </button>
          <h1 className="min-w-0 flex-1 truncate px-2 text-center font-sans text-lg font-black tracking-tight text-[var(--text-headline)]">
            {title}
          </h1>
          <div className="flex w-[9.5rem] shrink-0 justify-end">
            {activeGame ? (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-12 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card-surface)] p-2 font-sans text-xs font-bold text-[var(--text-headline)] active:scale-95"
              >
                <RotateCcw className="size-3.5 shrink-0" aria-hidden />
                {shell.resetShort}
              </button>
            ) : (
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
            )}
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-3 pt-3">
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
