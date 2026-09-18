"use client";

import { useEffect, useState } from "react";
import { tenantConfig } from "@/config/tenant.config";
import { logCampaignEvent } from "@/lib/analytics";

const SESSION_KEY = "arada_session_logged";

export function PwaRuntime({ tenantId }: { tenantId: string }) {
  const [offline, setOffline] = useState(false);
  const copy = tenantConfig.copy.landing;

  useEffect(() => {
    function sync() {
      setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration is optional on unsupported browsers.
      });
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      return;
    }
    void logCampaignEvent(tenantId, "session_start");
  }, [tenantId]);

  if (!offline) return null;

  return (
    <p
      role="status"
      className="fixed inset-x-0 top-0 z-[60] mx-auto w-full max-w-md px-5 py-3 text-center font-sans text-sm font-bold text-[var(--btn-text)] bg-[var(--btn-primary)] pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      {copy.offlineBanner}
    </p>
  );
}
