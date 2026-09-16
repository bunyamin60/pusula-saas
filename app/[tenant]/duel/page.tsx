"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DuelLobbyDrawer } from "@/components/DuelLobby";
import { GuestShell } from "@/components/GuestShell";
import type { DuelGameId } from "@/config/tenant.config";
import { getActiveTenantId } from "@/lib/campaignState";

function duelModeToGame(mode: string | null): DuelGameId | null {
  if (mode === "pop_trivia") return "trivia";
  if (mode === "reflex") return "swipe";
  return null;
}

function DuelPageBody() {
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();
  const router = useRouter();
  const search = useSearchParams();
  const focusGame = duelModeToGame(search.get("mode"));

  useEffect(() => {
    if (!focusGame) router.replace(`/${tenantId}`);
  }, [focusGame, router, tenantId]);

  if (!focusGame) return null;

  return (
    <GuestShell tenantId={tenantId}>
      <DuelLobbyDrawer
        variant="page"
        focusGame={focusGame}
        onClose={() => router.push(`/${tenantId}`)}
      />
    </GuestShell>
  );
}

export default function DuelPage() {
  return (
    <Suspense fallback={null}>
      <DuelPageBody />
    </Suspense>
  );
}
