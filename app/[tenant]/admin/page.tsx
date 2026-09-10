"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { AdminLogin } from "@/components/AdminLogin";
import { CampaignForm } from "@/components/CampaignForm";
import {
  getServerAdminAuth,
  getAdminAuth,
  lockAdmin,
  readStoredAdminAuth,
  setAdminAuth,
  subscribeToAdminAuth,
} from "@/lib/adminAuth";
import { getActiveTenantId, resetCampaign, saveCampaign } from "@/lib/campaignState";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { useCampaign } from "@/lib/useCampaign";

export default function TenantAdminPage() {
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId() ?? DEFAULT_TENANT_ID;
  const authed = useSyncExternalStore(
    subscribeToAdminAuth,
    getAdminAuth,
    getServerAdminAuth,
  );
  const campaign = useCampaign();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (readStoredAdminAuth(tenantId)) setAdminAuth(true);
    setReady(true);
  }, [tenantId]);

  const login = useCallback(() => setAdminAuth(true, tenantId), [tenantId]);
  const logout = useCallback(() => lockAdmin(tenantId), [tenantId]);

  if (!ready) {
    return <main className="min-h-dvh bg-background" />;
  }

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
