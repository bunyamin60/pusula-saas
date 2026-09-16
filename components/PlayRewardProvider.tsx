"use client";

import {
  createContext,
  useCallback,
  useContext,
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
  subscribePlaySession,
} from "@/lib/playReward";

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
  const { inMatch, inDrawRoom } = useDuel();
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
      timer.elapsedSeconds,
      timer.isUnlocked,
      timer.isGameActive,
      timer.isPaused,
      timer.claimedCode,
      timer.recipeId,
      timer.clockLabel,
      timer.pausedLabel,
      timer.progress,
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
