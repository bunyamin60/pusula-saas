"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AdminLogin } from "@/components/AdminLogin";
import { CampaignForm } from "@/components/CampaignForm";
import {
  getServerAdminAuth,
  getAdminAuth,
  lockAdmin,
  setAdminAuth,
  subscribeToAdminAuth,
} from "@/lib/adminAuth";
import { resetCampaign, saveCampaign } from "@/lib/campaignState";
import { useCampaign } from "@/lib/useCampaign";

export default function TenantAdminPage() {
  const authed = useSyncExternalStore(
    subscribeToAdminAuth,
    getAdminAuth,
    getServerAdminAuth,
  );
  const campaign = useCampaign();

  useEffect(() => {
    lockAdmin();

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) lockAdmin();
    };
    const onHide = () => lockAdmin();

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      lockAdmin();
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);

  const login = useCallback(() => setAdminAuth(true), []);
  const logout = useCallback(() => lockAdmin(), []);

  if (!authed) {
    return (
      <main className="min-h-dvh bg-background">
        <AdminLogin onSuccess={login} />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background">
      <CampaignForm
        initial={campaign}
        onSave={saveCampaign}
        onReset={resetCampaign}
        onLogout={logout}
      />
    </main>
  );
}
