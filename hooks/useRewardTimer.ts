"use client";

import { useEffect, useSyncExternalStore } from "react";
import { tenantConfig } from "@/config/tenant.config";
import {
  getActiveTenantId,
  getCampaignSettings,
  getServerCampaign,
  subscribeToCampaign,
} from "@/lib/campaignState";
import {
  applyPlayRewardTick,
  formatPlayClock,
  getClientPlayReward,
  getServerPlayReward,
  playRewardTargetMinutes,
  playRewardTargetSeconds,
  sealPlayRewardClaim,
  subscribePlayReward,
  syncPlayHeartbeat,
} from "@/lib/playReward";

export function useRewardTimer(isGameActive: boolean) {
  const progress = useSyncExternalStore(
    subscribePlayReward,
    getClientPlayReward,
    getServerPlayReward,
  );
  // Recompute target when admin changes ikram süresi.
  useSyncExternalStore(subscribeToCampaign, getCampaignSettings, getServerCampaign);

  const targetSeconds = playRewardTargetSeconds();
  const targetMinutes = playRewardTargetMinutes();
  const elapsedSeconds = Math.min(progress.elapsedSeconds, targetSeconds);
  const ratio = targetSeconds > 0 ? elapsedSeconds / targetSeconds : 0;
  const clockLabel = tenantConfig.copy.playReward.clockTemplate
    .replace("{elapsed}", formatPlayClock(elapsedSeconds))
    .replace("{target}", formatPlayClock(targetSeconds));

  useEffect(() => {
    const running = () =>
      isGameActive && document.visibilityState === "visible";

    applyPlayRewardTick(Date.now(), running());

    let cancelled = false;
    // Lobby pings move the server clock without adding time. The first
    // in-game ping must not count that gap, or the clock opens at 5–8s.
    let anchor: Promise<unknown> | null = null;
    const beat = (playing: boolean) => {
      void (async () => {
        if (playing) {
          anchor ??= syncPlayHeartbeat(getActiveTenantId(), false);
          await anchor;
        }
        if (cancelled) return;
        await syncPlayHeartbeat(getActiveTenantId(), playing);
      })();
    };

    let lastRush = 0;
    const tick = () => {
      const next = applyPlayRewardTick(Date.now(), running());
      if (!running() || next.claimedCode) return;
      const remaining = targetSeconds - next.elapsedSeconds;
      if (remaining > 15) return;
      const now = Date.now();
      if (now - lastRush < 2000) return;
      lastRush = now;
      beat(true);
    };

    const timer = window.setInterval(tick, tenantConfig.playReward.tickMs);
    const beatTimer = window.setInterval(() => beat(running()), 10_000);
    beat(running());

    function onVisibility() {
      applyPlayRewardTick(Date.now(), running());
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    window.addEventListener("pageshow", onVisibility);

    return () => {
      cancelled = true;
      applyPlayRewardTick(Date.now(), false);
      window.clearInterval(timer);
      window.clearInterval(beatTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
    };
  }, [isGameActive, targetSeconds]);

  return {
    elapsedSeconds,
    targetSeconds,
    targetMinutes,
    remainingSeconds: Math.max(0, targetSeconds - elapsedSeconds),
    progress: Math.min(1, Math.max(0, ratio)),
    isUnlocked:
      progress.isUnlocked || elapsedSeconds >= Math.max(1, targetSeconds - 1),
    isGameActive,
    isPaused: !isGameActive,
    claimedCode: progress.claimedCode,
    redeemedAt: progress.redeemedAt ?? null,
    recipeId: progress.recipeId ?? null,
    clockLabel,
    pausedLabel: tenantConfig.copy.playReward.pausedLabel.replace(
      "{clock}",
      clockLabel,
    ),
    sealClaim: sealPlayRewardClaim,
  };
}
