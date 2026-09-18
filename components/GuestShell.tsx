"use client";

import type { ReactNode } from "react";
import { GuestDock } from "@/components/GuestDock";
import { GuestProviders } from "@/components/GuestProviders";
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
      <main
        className={`relative mx-auto flex w-full max-w-md flex-col overflow-x-hidden bg-[var(--bg-canvas)] px-5 pt-[env(safe-area-inset-top)] ${
          locked ? "h-[100dvh] overflow-hidden overscroll-none" : "min-h-[100dvh]"
        }`}
        style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        <RewardProgressBar compact />
        {children}
        <GuestDock />
      </main>
    </GuestProviders>
  );
}
