"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { DuelProvider, DuelStage } from "@/components/DuelProvider";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PlayRewardProvider } from "@/components/PlayRewardProvider";
import { RewardClaimModal } from "@/components/RewardClaimModal";
import { TableSessionBootstrap } from "@/components/TableSessionBootstrap";
import { syncGuestTableSession } from "@/lib/tableSession";

const pendingGuestSessions = new Map<
  string,
  Promise<Awaited<ReturnType<typeof syncGuestTableSession>>>
>();

function loadGuestSession(tenantId: string) {
  const existing = pendingGuestSessions.get(tenantId);
  if (existing) return existing;
  const pending = syncGuestTableSession({ tenantId, action: "touch" }).finally(() => {
    pendingGuestSessions.delete(tenantId);
  });
  pendingGuestSessions.set(tenantId, pending);
  return pending;
}

export function GuestProviders({
  tenantId,
  extraActive = false,
  children,
}: {
  tenantId: string;
  extraActive?: boolean;
  children: ReactNode;
}) {
  const [session, setSession] = useState<{
    tenantId: string;
    guestId: string;
    venueVerified: boolean;
  } | null>(null);
  const [failedTenant, setFailedTenant] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    let failures = 0;

    async function load() {
      const loadedSession = await loadGuestSession(tenantId);
      if (cancelled) return;
      if (loadedSession?.guestId) {
        setSession({
          tenantId,
          guestId: loadedSession.guestId,
          venueVerified: loadedSession.table?.venueVerified === true,
        });
        setFailedTenant(null);
        return;
      }

      failures += 1;
      if (failures >= 3) {
        setFailedTenant(tenantId);
        return;
      }

      const delay = failures === 1 ? 3000 : 10_000;
      retryTimer = window.setTimeout(load, delay);
    }

    void load();
    return () => {
      cancelled = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
    };
  }, [loadAttempt, tenantId]);

  const handleVerificationChange = useCallback((venueVerified: boolean) => {
    setSession((current) =>
      current ? { ...current, venueVerified } : current,
    );
  }, []);

  if (failedTenant === tenantId) {
    return (
      <LoadingScreen
        message="Masa oturumu başlatılamadı. Lütfen tekrar deneyin."
        actionLabel="Tekrar dene"
        onAction={() => {
          setFailedTenant(null);
          setLoadAttempt((attempt) => attempt + 1);
        }}
      />
    );
  }

  if (!session || session.tenantId !== tenantId) return <LoadingScreen />;

  return (
    <DuelProvider
      tenantId={tenantId}
      clientId={session.guestId}
      venueVerified={session.venueVerified}
    >
      <PlayRewardProvider extraActive={extraActive}>
        <TableSessionBootstrap onVenueVerificationChange={handleVerificationChange} />
        {children}
        <RewardClaimModal />
        <DuelStage />
      </PlayRewardProvider>
    </DuelProvider>
  );
}
