"use client";

import { useParams } from "next/navigation";
import { usePlayReward } from "@/components/PlayRewardProvider";
import { tenantConfig } from "@/config/tenant.config";
import { resetPusulaCountedFlag } from "@/lib/analytics";
import { getActiveTenantId } from "@/lib/campaignState";
import { clearLoyalty } from "@/lib/loyalty";
import { clearPlayRewardProgress } from "@/lib/playReward";
import { clearCustomerProfile } from "@/lib/customerProfile";
import { clearGossipLocalState } from "@/lib/dailyQuestion";
import { resetSession } from "@/lib/session";
import { clearStampCard } from "@/lib/stampCard";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export function DeviceTestReset() {
  const copy = tenantConfig.copy.match;
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId() ?? DEFAULT_TENANT_ID;
  const { completeDemo } = usePlayReward();

  function resetDevice() {
    try {
      clearLoyalty(tenantId);
      resetPusulaCountedFlag();
      clearPlayRewardProgress();
      resetSession();
      clearCustomerProfile();
      clearGossipLocalState();
      clearStampCard(tenantId);
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
