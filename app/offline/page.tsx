"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { tenantConfig } from "@/config/tenant.config";

export default function OfflinePage() {
  const copy = tenantConfig.copy.landing;

  return (
    <main
      className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[var(--bg-canvas)] p-6 text-center text-[var(--text-headline)] select-none [font-family:var(--font-sans),system-ui,-apple-system,BlinkMacSystemFont,sans-serif] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="mb-4 rounded-full bg-[color-mix(in_srgb,var(--card-surface)_80%,transparent)] p-5">
          <WifiOff
            className="size-10 text-[var(--text-headline)]"
            strokeWidth={2.25}
            aria-hidden
          />
        </div>
        <h1 className="mb-2 font-sans text-2xl font-black tracking-tight text-[var(--text-headline)] sm:text-3xl">
          {copy.offlineTitle}
        </h1>
        <p className="mb-8 max-w-xs font-sans text-sm font-medium leading-relaxed text-[var(--text-body)]">
          {copy.offlineLead}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex min-h-[48px] w-full max-w-xs cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[var(--btn-primary)] px-6 py-3.5 font-sans text-base font-extrabold text-[var(--btn-text)] shadow-lg shadow-[color-mix(in_srgb,var(--btn-primary)_20%,transparent)] transition-all hover:brightness-95 active:scale-[0.97] active:brightness-95"
        >
          <RefreshCw className="size-5 shrink-0" aria-hidden />
          {copy.offlineRetry}
        </button>
      </div>
    </main>
  );
}
