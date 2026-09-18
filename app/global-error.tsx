"use client";

import { RecoverScreen } from "@/components/RecoverScreen";
import { tenantConfig } from "@/config/tenant.config";
import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body className="min-h-full bg-background font-sans text-ink">
        <RecoverScreen
          title={tenantConfig.copy.landing.recoverTitle}
          lead={tenantConfig.copy.landing.recoverLead}
          actionLabel={tenantConfig.copy.landing.recoverRetry}
          onAction={reset}
        />
      </body>
    </html>
  );
}
