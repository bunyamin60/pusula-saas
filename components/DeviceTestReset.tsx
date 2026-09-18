"use client";

import { useParams } from "next/navigation";
import { usePlayReward } from "@/components/PlayRewardProvider";
import { tenantConfig } from "@/config/tenant.config";
import { getActiveTenantId } from "@/lib/campaignState";
import { wipeGuestLocalData } from "@/lib/guestWipe";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export function DeviceTestReset() {
  const copy = tenantConfig.copy.match;
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId() ?? DEFAULT_TENANT_ID;
  const { completeDemo } = usePlayReward();

  function resetDevice() {
    try {
      wipeGuestLocalData(tenantId);
    } catch {
      // Test helper must never throw into the guest flow.
    }
    window.location.reload();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={completeDemo}
        className="text-[11px] font-semibold text-[var(--text-headline)]/55 underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--text-headline)]"
      >
        {copy.demoComplete}
      </button>
      <button
        type="button"
        onClick={resetDevice}
        className="text-[11px] text-muted/45 underline decoration-transparent underline-offset-4 transition-colors hover:text-muted"
      >
        {copy.resetDevice}
      </button>
    </div>
  );
}
