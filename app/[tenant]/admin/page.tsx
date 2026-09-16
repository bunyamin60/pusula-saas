"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminLogin } from "@/components/AdminLogin";
import {
  getServerAdminAuth,
  getAdminAuth,
  lockAdmin,
  readStoredAdminAuth,
  setAdminAuth,
  subscribeToAdminAuth,
} from "@/lib/adminAuth";
import { getActiveTenantId } from "@/lib/campaignState";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export default function TenantAdminPage() {
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId() ?? DEFAULT_TENANT_ID;
  const authed = useSyncExternalStore(
    subscribeToAdminAuth,
    getAdminAuth,
    getServerAdminAuth,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (readStoredAdminAuth(tenantId)) setAdminAuth(true);
    setReady(true);
  }, [tenantId]);

  const login = useCallback(() => setAdminAuth(true, tenantId), [tenantId]);
  const logout = useCallback(() => lockAdmin(tenantId), [tenantId]);

  if (!ready) {
    return <main className="min-h-dvh bg-[var(--bg-canvas)]" />;
  }

  if (!authed) {
    return (
      <main className="min-h-dvh bg-[var(--bg-canvas)]">
        <AdminLogin onSuccess={login} />
      </main>
    );
  }

  return <AdminDashboard onLogout={logout} />;
}
