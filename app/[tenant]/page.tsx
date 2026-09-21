"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GuestDock } from "@/components/GuestDock";
import { GuestProviders } from "@/components/GuestProviders";
import { Landing } from "@/components/Landing";
import { PhoneShell } from "@/components/PhoneShell";
import { logCampaignEvent } from "@/lib/analytics";
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
  const [view, setView] = useState<VenueHomeView>(() =>
    typeof window === "undefined" ? "welcome" : readVenueHomeView(tenantId),
  );

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
    void logCampaignEvent(tenantId, "home_cta");
  }

  function backWelcome() {
    writeVenueHomeView(tenantId, "welcome");
    window.history.replaceState({ venueHome: "welcome" }, "");
    setView("welcome");
  }

  return (
    <GuestProviders tenantId={tenantId}>
      <PhoneShell paddedBottom={view === "lobby"}>
        <Landing
          view={view}
          onEnterLobby={enterLobby}
          onBackWelcome={backWelcome}
        />
        {view === "lobby" ? <GuestDock /> : null}
        <span className="sr-only">{campaign.brandName}</span>
      </PhoneShell>
    </GuestProviders>
  );
}
