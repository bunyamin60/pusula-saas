"use client";

import { useEffect, useSyncExternalStore } from "react";
import { tenantConfig } from "@/config/tenant.config";
import {
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

    const tick = () => {
      applyPlayRewardTick(Date.now(), running());
    };

    const timer = window.setInterval(tick, tenantConfig.playReward.tickMs);

    function onVisibility() {
      applyPlayRewardTick(Date.now(), running());
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    window.addEventListener("pageshow", onVisibility);

    return () => {
      applyPlayRewardTick(Date.now(), false);
      window.clearInterval(timer);
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
    isUnlocked: progress.isUnlocked || elapsedSeconds >= targetSeconds,
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
