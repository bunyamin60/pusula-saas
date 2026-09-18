"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { RecoverScreen } from "@/components/RecoverScreen";
import { logCampaignEvent } from "@/lib/analytics";
import { getActiveTenantId } from "@/lib/campaignState";

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();

  useEffect(() => {
    void logCampaignEvent(tenantId, "error_shown", error.digest);
  }, [error.digest, tenantId]);

  return <RecoverScreen onAction={reset} />;
}
