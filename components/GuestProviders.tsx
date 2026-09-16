"use client";

import type { ReactNode } from "react";
import { DuelProvider, DuelStage } from "@/components/DuelProvider";
import { PlayRewardProvider } from "@/components/PlayRewardProvider";
import { RewardClaimModal } from "@/components/RewardClaimModal";

export function GuestProviders({
  tenantId,
  extraActive = false,
  children,
}: {
  tenantId: string;
  extraActive?: boolean;
  children: ReactNode;
}) {
  return (
    <DuelProvider tenantId={tenantId}>
      <PlayRewardProvider extraActive={extraActive}>
        {children}
        <RewardClaimModal />
        <DuelStage />
      </PlayRewardProvider>
    </DuelProvider>
  );
}
