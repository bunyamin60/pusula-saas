"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, SearchX, WifiOff } from "lucide-react";
import { tenantConfig } from "@/config/tenant.config";

export type StatusVariant = "offline" | "recover" | "notFound";

type StatusScreenProps = {
  variant: StatusVariant;
  title?: string;
  lead?: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
};

const ICONS = {
  offline: WifiOff,
  recover: AlertTriangle,
  notFound: SearchX,
} as const;

export function StatusScreen({
  variant,
  title,
  lead,
  actionLabel,
  onAction,
  href,
}: StatusScreenProps) {
  const copy = tenantConfig.copy.landing;
  const Icon = ICONS[variant];
  const resolved = {
    offline: {
      title: title ?? copy.offlineTitle,
      lead: lead ?? copy.offlineLead,
      action: actionLabel ?? copy.offlineRetry,
    },
    recover: {
      title: title ?? copy.recoverTitle,
      lead: lead ?? copy.recoverLead,
      action: actionLabel ?? copy.recoverRetry,
    },
    notFound: {
      title: title ?? copy.notFoundTitle,
      lead: lead ?? copy.notFoundLead,
      action: actionLabel ?? copy.notFoundHome,
    },
  }[variant];

  const actionClassName =
    "flex min-h-12 w-full max-w-xs cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[var(--btn-primary)] px-6 py-3.5 font-sans text-base font-extrabold text-[var(--btn-text)] shadow-sm transition hover:brightness-95 active:scale-95 active:brightness-95";

  return (
    <main className="flex min-h-[100dvh] w-full justify-center bg-[var(--bg-canvas)] select-none">
      <section className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <div className="mb-4 rounded-full border border-[var(--card-border)] bg-[var(--card-surface)] p-5">
          <Icon
            className="size-10 text-[var(--text-headline)]"
            strokeWidth={2.25}
            aria-hidden
          />
        </div>
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-[var(--text-headline)] sm:text-3xl">
          {resolved.title}
        </h1>
        <p className="mt-3 max-w-xs font-sans text-sm font-medium leading-relaxed text-[var(--text-body)]">
          {resolved.lead}
        </p>
        <div className="mt-8 w-full max-w-xs">
          {href ? (
            <Link href={href} className={actionClassName}>
              {resolved.action}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction ?? (() => window.location.reload())}
              className={actionClassName}
            >
              {variant !== "notFound" ? (
                <RefreshCw className="size-5 shrink-0" aria-hidden />
              ) : null}
              {resolved.action}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
