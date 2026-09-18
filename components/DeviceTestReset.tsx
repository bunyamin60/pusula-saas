"use client";

import { useEffect, useState } from "react";
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
  const [isConfirming, setIsConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfirming) return;
    const timer = window.setTimeout(() => setIsConfirming(false), 5000);
    return () => window.clearTimeout(timer);
  }, [isConfirming]);

  function resetDevice() {
    try {
      wipeGuestLocalData(tenantId);
    } catch {
      // Test helper must never throw into the guest flow.
    }
    setToast(copy.resetDeviceDone);
    window.setTimeout(() => window.location.reload(), 900);
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={completeDemo}
          className="min-h-12 px-2 text-[11px] font-semibold text-[var(--text-headline)]/55 underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--text-headline)] active:scale-95"
        >
          {copy.demoComplete}
        </button>
        {isConfirming ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={resetDevice}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--quiz-bad)] px-3.5 py-2 font-sans text-[11px] font-bold text-[var(--quiz-on-feedback)] transition active:scale-95 active:brightness-95"
            >
              {copy.resetDeviceConfirm}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--card-surface)] px-3.5 py-2 font-sans text-[11px] font-medium text-[var(--text-body)] transition active:scale-95 active:brightness-95"
            >
              {copy.resetDeviceCancel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            className="min-h-12 px-2 text-[11px] text-[var(--text-body)]/45 underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--text-body)] active:scale-95"
          >
            {copy.resetDevice}
          </button>
        )}
      </div>
      {toast ? (
        <p
          role="status"
          className="rounded-2xl bg-[var(--text-headline)] px-4 py-2.5 text-center font-sans text-xs font-bold text-[var(--bg-canvas)] shadow-md"
        >
          {toast}
        </p>
      ) : null}
    </div>
  );
}
