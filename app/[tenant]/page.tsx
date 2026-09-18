"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { GuestDock } from "@/components/GuestDock";
import { GuestProviders } from "@/components/GuestProviders";
import { Landing } from "@/components/Landing";
import { getActiveTenantId } from "@/lib/campaignState";
import { useCampaign } from "@/lib/useCampaign";
import {
  readVenueHomeView,
  writeVenueHomeView,
  type VenueHomeView,
} from "@/lib/venueHome";

function historyView(state: unknown): VenueHomeView {
  return state &&
    typeof state === "object" &&
    "venueHome" in state &&
    (state as { venueHome: VenueHomeView }).venueHome === "lobby"
    ? "lobby"
    : "welcome";
}

export default function TenantHome() {
  const campaign = useCampaign();
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();
  const [view, setView] = useState<VenueHomeView>("welcome");

  useEffect(() => {
    const next = readVenueHomeView(tenantId);
    setView(next);
    window.history.replaceState({ venueHome: next }, "");
    function onPop(event: PopStateEvent) {
      const popped = historyView(event.state);
      writeVenueHomeView(tenantId, popped);
      setView(popped);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [tenantId]);

  function enterLobby() {
    writeVenueHomeView(tenantId, "lobby");
    window.history.pushState({ venueHome: "lobby" }, "");
    setView("lobby");
  }

  function backWelcome() {
    if (historyView(window.history.state) === "lobby") {
      window.history.back();
      return;
    }
    writeVenueHomeView(tenantId, "welcome");
    window.history.replaceState({ venueHome: "welcome" }, "");
    setView("welcome");
  }

  return (
    <GuestProviders tenantId={tenantId}>
      <Shell paddedBottom={view === "lobby"}>
        <Landing
          view={view}
          onEnterLobby={enterLobby}
          onBackWelcome={backWelcome}
        />
        {view === "lobby" ? <GuestDock /> : null}
        <span className="sr-only">{campaign.brandName}</span>
      </Shell>
    </GuestProviders>
  );
}

function Shell({
  children,
  paddedBottom,
}: {
  children: ReactNode;
  paddedBottom: boolean;
}) {
  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-[var(--card-surface)]">
      <main
        className={`relative mx-auto flex h-[100dvh] min-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[var(--bg-canvas)] px-5 pt-[env(safe-area-inset-top)] shadow-2xl ${
          paddedBottom
            ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
            : "pb-[env(safe-area-inset-bottom)]"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
