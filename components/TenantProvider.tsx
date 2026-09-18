"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { PwaRuntime } from "@/components/PwaRuntime";
import { SeededCampaignContext } from "@/lib/useCampaign";
import {
  bindTenant,
  primeTenant,
  type CampaignSettings,
} from "@/lib/campaignState";
import { bindSessionTenant } from "@/lib/session";
import { applyThemeTokens } from "@/lib/themeCss";
import { tokensFromThemeConfig } from "@/lib/tenant";
import { useCampaign } from "@/lib/useCampaign";

type TenantProviderProps = {
  tenantId: string;
  initial: CampaignSettings;
  children: ReactNode;
};

export function TenantProvider({
  tenantId,
  initial,
  children,
}: TenantProviderProps) {
  if (typeof window !== "undefined") {
    primeTenant(tenantId, initial);
  }

  return (
    <SeededCampaignContext.Provider value={initial}>
      <TenantThemeSync tenantId={tenantId} initial={initial} />
      <PwaRuntime tenantId={tenantId} />
      {children}
    </SeededCampaignContext.Provider>
  );
}

function TenantThemeSync({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: CampaignSettings;
}) {
  const campaign = useCampaign();

  useLayoutEffect(() => {
    bindSessionTenant(tenantId);
    bindTenant(tenantId, initial);
  }, [tenantId, initial]);

  useLayoutEffect(() => {
    applyThemeTokens(tokensFromThemeConfig(campaign.themeConfig));
    document.title = campaign.location
      ? `${campaign.brandName} · ${campaign.location}`
      : campaign.brandName;
  }, [campaign]);

  return null;
}
