"use client";

import { useEffect } from "react";
import { RecoverScreen } from "@/components/RecoverScreen";
import { logCampaignEvent } from "@/lib/analytics";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void logCampaignEvent(DEFAULT_TENANT_ID, "error_shown", error.digest);
  }, [error.digest]);

  return <RecoverScreen onAction={reset} />;
}
