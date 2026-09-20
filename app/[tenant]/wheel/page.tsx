"use client";

import { useParams, useRouter } from "next/navigation";
import { BillWheel } from "@/components/BillWheel";
import { GameContainer } from "@/components/GameContainer";
import { GuestProviders } from "@/components/GuestProviders";
import { tenantConfig } from "@/config/tenant.config";
import { getActiveTenantId } from "@/lib/campaignState";

export default function WheelPage() {
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();
  const router = useRouter();

  return (
    <GuestProviders tenantId={tenantId} extraActive>
      <GameContainer
        title={tenantConfig.copy.landing.showcase.billTitle}
        sessionGame="bill"
        onBack={() => router.push(`/${tenantId}`)}
      >
        <BillWheel />
      </GameContainer>
    </GuestProviders>
  );
}
