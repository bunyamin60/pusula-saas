"use client";

import { StatusScreen } from "@/components/StatusScreen";
import { tenantConfig } from "@/config/tenant.config";

export function RecoverScreen({
  title,
  lead,
  actionLabel,
  onAction,
}: {
  title?: string;
  lead?: string;
  actionLabel?: string;
  onAction: () => void;
}) {
  const copy = tenantConfig.copy.landing;
  return (
    <StatusScreen
      variant="recover"
      title={title ?? copy.recoverTitle}
      lead={lead ?? copy.recoverLead}
      actionLabel={actionLabel ?? copy.recoverRetry}
      onAction={onAction}
    />
  );
}
