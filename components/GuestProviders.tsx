"use client";

import type { ReactNode } from "react";
import { DuelProvider, DuelStage } from "@/components/DuelProvider";
import { PlayRewardProvider } from "@/components/PlayRewardProvider";
import { RewardClaimModal } from "@/components/RewardClaimModal";
import { TableSessionBootstrap } from "@/components/TableSessionBootstrap";

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
        <TableSessionBootstrap />
        {children}
        <RewardClaimModal />
        <DuelStage />
      </PlayRewardProvider>
    </DuelProvider>
  );
}
