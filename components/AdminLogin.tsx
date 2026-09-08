"use client";

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
    <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <BrandWordmark compact />
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
        {copy.kicker}
      </p>
      <h1 className="mt-2 font-display text-[1.85rem] text-ink">{copy.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{copy.loginLead}</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
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
            className="mt-2 w-full rounded-2xl border border-transparent bg-surface px-4 py-3.5 text-ink outline-none focus:border-primary"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-red-700">{copy.loginError}</p>}
        <button type="submit" className="btn-primary w-full">
          {copy.loginCta}
        </button>
      </form>
    </section>
  );
}
