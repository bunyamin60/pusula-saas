"use client";

import { RecoverScreen } from "@/components/RecoverScreen";
import { tenantConfig } from "@/config/tenant.config";

export default function OfflinePage() {
  return (
    <RecoverScreen
      title={tenantConfig.copy.landing.offlineBanner}
      lead={tenantConfig.copy.landing.recoverLead}
      actionLabel={tenantConfig.copy.landing.recoverRetry}
      onAction={() => window.location.assign("/")}
    />
  );
}
