"use client";

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
    <div className="flex min-h-[100dvh] w-full justify-center bg-[var(--card-surface)]">
      <section className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-[var(--text-headline)]">
          {title ?? copy.recoverTitle}
        </h1>
        <p className="mt-3 font-sans text-sm font-medium leading-relaxed text-[var(--text-body)]">
          {lead ?? copy.recoverLead}
        </p>
        <button
          type="button"
          onClick={onAction}
          className="btn-primary mt-8 min-h-12 w-full"
        >
          {actionLabel ?? copy.recoverRetry}
        </button>
      </section>
    </div>
  );
}
