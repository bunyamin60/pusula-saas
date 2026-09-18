"use client";

import type { ReactNode } from "react";
import { GuestDock } from "@/components/GuestDock";
import { GuestProviders } from "@/components/GuestProviders";
import { PhoneShell } from "@/components/PhoneShell";
import { RewardProgressBar } from "@/components/RewardProgressBar";

export function GuestShell({
  tenantId,
  extraActive = false,
  locked = false,
  children,
}: {
  tenantId: string;
  extraActive?: boolean;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <GuestProviders tenantId={tenantId} extraActive={extraActive}>
      <PhoneShell paddedBottom>
        <div
          className={`flex min-h-0 flex-1 flex-col px-5 ${
            locked ? "overflow-hidden overscroll-none" : "overflow-x-hidden overflow-y-auto"
          }`}
        >
          <RewardProgressBar compact />
          {children}
        </div>
        <GuestDock />
      </PhoneShell>
    </GuestProviders>
  );
}
