"use client";

import { useParams } from "next/navigation";
import { tenantConfig } from "@/config/tenant.config";
import { resetPusulaCountedFlag } from "@/lib/analytics";
import { getActiveTenantId } from "@/lib/campaignState";
import { clearLoyalty } from "@/lib/loyalty";
import { resetSession } from "@/lib/session";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export function DeviceTestReset() {
  const copy = tenantConfig.copy.match.resetDevice;
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId() ?? DEFAULT_TENANT_ID;

  function resetDevice() {
    try {
      clearLoyalty(tenantId);
      resetPusulaCountedFlag();
      resetSession();
    } catch {
      // Test helper must never throw into the guest flow.
    }
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={resetDevice}
      className="mx-auto mt-4 block text-[11px] text-muted/45 underline decoration-transparent underline-offset-4 transition-colors hover:text-muted"
    >
      {copy}
    </button>
  );
}
