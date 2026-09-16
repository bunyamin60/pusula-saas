"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { usePlayReward } from "@/components/PlayRewardProvider";
import { tenantConfig } from "@/config/tenant.config";
import { beginPlaySession, endPlaySession, formatPlayClock } from "@/lib/playReward";

type GameContainerProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
  overlay?: boolean;
  containerRef?: RefObject<HTMLDivElement | null>;
};

export function GameContainer({
  title,
  onBack,
  children,
  overlay = false,
  containerRef,
}: GameContainerProps) {
  const shell = tenantConfig.copy.landing.gameShell;
  const table =
    tenantConfig.brand.tableName.trim() || shell.tableFallback;
  const { elapsedSeconds } = usePlayReward();
  const clock = formatPlayClock(elapsedSeconds);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    beginPlaySession();
    return () => endPlaySession();
  }, []);

  return (
    <div
      ref={containerRef}
      className={
        overlay
          ? "fixed inset-0 z-[80] flex justify-center bg-background"
          : "flex min-h-dvh justify-center bg-background"
      }
    >
      <div
        className={`flex w-full max-w-md flex-col overflow-hidden bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] ${
          overlay ? "h-dvh" : "min-h-dvh"
        }`}
      >
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="justify-self-start rounded-full px-1 py-2 text-left font-sans text-[13px] font-semibold tracking-wide text-muted transition-colors hover:text-ink"
          >
            {shell.back}
          </button>
          <h1 className="max-w-[10rem] truncate text-center font-sans text-base font-extrabold leading-tight tracking-tight text-ink">
            {title}
          </h1>
          <div className="justify-self-end text-right">
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
              {table}
            </p>
            <p
              suppressHydrationWarning
              className="font-sans text-sm font-semibold tabular-nums text-ink"
            >
              {mounted ? clock : "00:00"}
            </p>
          </div>
        </header>
        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
