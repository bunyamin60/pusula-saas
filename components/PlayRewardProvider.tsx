"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useDuel } from "@/components/DuelProvider";
import { useRewardTimer } from "@/hooks/useRewardTimer";
import {
  completePlayRewardNow,
  isPlaySessionActive,
  markPlayRewardRedeemed,
  subscribePlaySession,
} from "@/lib/playReward";
import { fetchCouponRedemption } from "@/lib/rewardCoupons";

type PlayRewardContextValue = ReturnType<typeof useRewardTimer> & {
  claimOpen: boolean;
  openClaim: () => void;
  closeClaim: () => void;
  completeDemo: () => void;
};

const PlayRewardContext = createContext<PlayRewardContextValue | null>(null);

export function PlayRewardProvider({
  children,
  extraActive = false,
}: {
  children: ReactNode;
  extraActive?: boolean;
}) {
  const { tenantId, inMatch, inDrawRoom } = useDuel();
  const sessionActive = useSyncExternalStore(
    subscribePlaySession,
    isPlaySessionActive,
    () => false,
  );
  const isGameActive = inMatch || inDrawRoom || extraActive || sessionActive;
  const timer = useRewardTimer(isGameActive);
  const [claimOpen, setClaimOpen] = useState(false);

  const openClaim = useCallback(() => {
    if (!timer.isUnlocked) return;
    setClaimOpen(true);
  }, [timer.isUnlocked]);

  const closeClaim = useCallback(() => setClaimOpen(false), []);

  const completeDemo = useCallback(() => {
    completePlayRewardNow();
    setClaimOpen(true);
  }, []);

  // When kasa redeems the code, hide it on this device without a reload.
  useEffect(() => {
    const code = timer.claimedCode;
    if (!tenantId || !code || timer.redeemedAt) return;

    let alive = true;
    const poll = async () => {
      const status = await fetchCouponRedemption(tenantId, code);
      if (!alive || !status.redeemed) return;
      markPlayRewardRedeemed(status.redeemedAt);
    };

    void poll();
    const timerId = window.setInterval(() => void poll(), 4000);
    function onFocus() {
      void poll();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });

    return () => {
      alive = false;
      window.clearInterval(timerId);
      window.removeEventListener("focus", onFocus);
    };
  }, [tenantId, timer.claimedCode, timer.redeemedAt]);

  const value = useMemo(
    () => ({
      ...timer,
      claimOpen,
      openClaim,
      closeClaim,
      completeDemo,
    }),
    [
      claimOpen,
      closeClaim,
      completeDemo,
      openClaim,
      timer,
    ],
  );

  return (
    <PlayRewardContext.Provider value={value}>
      {children}
    </PlayRewardContext.Provider>
  );
}

export function usePlayReward(): PlayRewardContextValue {
  const value = useContext(PlayRewardContext);
  if (!value) {
    throw new Error("usePlayReward must be used within PlayRewardProvider");
  }
  return value;
}
