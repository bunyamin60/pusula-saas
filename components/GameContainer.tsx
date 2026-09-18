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
import { writeVenueHomeView } from "@/lib/venueHome";

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
          <div className="flex min-w-0 justify-self-end">
            {activeGame ? (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-12 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card-surface)] p-2 font-sans text-xs font-bold text-[var(--text-headline)] active:scale-95"
              >
                <RotateCcw className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate sm:inline">{shell.resetShort}</span>
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
