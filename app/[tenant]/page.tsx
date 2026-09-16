"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { GuestDock } from "@/components/GuestDock";
import { GuestProviders } from "@/components/GuestProviders";
import { RewardProgressBar } from "@/components/RewardProgressBar";
import { Landing } from "@/components/Landing";
import { getActiveTenantId } from "@/lib/campaignState";
import { useCampaign } from "@/lib/useCampaign";

export default function TenantHome() {
  const campaign = useCampaign();
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();

  return (
    <GuestProviders tenantId={tenantId}>
      <Shell>
        <RewardProgressBar compact />
        <Landing />
        <GuestDock />
        <span className="sr-only">{campaign.brandName}</span>
      </Shell>
    </GuestProviders>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden bg-background px-5 pt-[max(1rem,env(safe-area-inset-top))]"
      style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      {children}
    </main>
  );
}
