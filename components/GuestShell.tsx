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
        className={`mx-auto flex w-full max-w-md flex-col overflow-x-hidden bg-background px-5 pt-[max(1rem,env(safe-area-inset-top))] ${
          locked ? "h-dvh overflow-hidden overscroll-none" : "min-h-dvh"
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
