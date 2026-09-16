"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { DrawGate } from "@/components/DrawGate";
import { GameContainer } from "@/components/GameContainer";
import { GuestProviders } from "@/components/GuestProviders";
import { useDuel } from "@/components/DuelProvider";
import { tenantConfig } from "@/config/tenant.config";
import { getActiveTenantId } from "@/lib/campaignState";

export default function DrawPage() {
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();

  return (
    <GuestProviders tenantId={tenantId} extraActive>
      <DrawBoot tenantId={tenantId} />
    </GuestProviders>
  );
}

function DrawBoot({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const { joinDrawRoom, inDrawRoom } = useDuel();
  const wasIn = useRef(false);

  useEffect(() => {
    if (inDrawRoom) {
      wasIn.current = true;
      return;
    }
    if (wasIn.current) router.replace(`/${tenantId}`);
  }, [inDrawRoom, router, tenantId]);

  if (inDrawRoom) return null;

  return (
    <GameContainer
      title={tenantConfig.copy.duel.draw.title}
      onBack={() => router.push(`/${tenantId}`)}
    >
      <DrawGate tenantId={tenantId} onJoin={joinDrawRoom} />
    </GameContainer>
  );
}
