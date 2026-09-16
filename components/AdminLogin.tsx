"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { BrandWordmark } from "@/components/BrandWordmark";
import { tenantConfig } from "@/config/tenant.config";
import { adminPasswordAccepted } from "@/lib/adminAuth";
import { getActiveTenantId } from "@/lib/campaignState";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { useCampaign } from "@/lib/useCampaign";

type AdminLoginProps = {
  onSuccess: () => void;
};

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const copy = tenantConfig.copy.admin;
  const campaign = useCampaign();
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId() ?? DEFAULT_TENANT_ID;
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      adminPasswordAccepted(password, {
        tenantId,
        adminPassword: campaign.adminPassword,
        baristaPin: campaign.baristaPin,
      })
    ) {
      onSuccess();
      return;
    }
    setError(true);
  }

  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[var(--bg-canvas)] px-5 py-8 text-[var(--text-headline)]">
      <div className="flex items-start justify-between gap-3">
        <BrandWordmark compact markOnly />
        <Link
          href={`/${tenantId}`}
          className="max-w-[8.75rem] shrink-0 rounded-full border border-[var(--text-headline)]/20 bg-[var(--card-surface)] px-3 py-1.5 text-right text-[11px] font-semibold leading-snug text-[var(--text-headline)] transition hover:opacity-90"
        >
          {copy.openApp}
        </Link>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-body)]">
        {copy.kicker}
      </p>
      <h1 className="mt-2 font-display text-[1.85rem] text-[var(--text-headline)]">{copy.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-body)]">{copy.loginLead}</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {copy.passwordLabel}
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(false);
            }}
            placeholder={copy.passwordPlaceholder}
            className="mt-2 w-full rounded-2xl border border-[var(--text-headline)]/15 bg-[var(--card-surface)] px-4 py-3.5 text-[var(--text-headline)] outline-none placeholder:text-[var(--text-body)] focus:border-[var(--btn-primary)]"
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="text-sm text-red-500">{copy.loginError}</p> : null}
        <button type="submit" className="btn-primary w-full min-h-14">
          {copy.loginCta}
        </button>
      </form>
    </section>
  );
}
