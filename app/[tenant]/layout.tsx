import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TenantProvider } from "@/components/TenantProvider";
import { tenantConfig } from "@/config/tenant.config";
import {
  campaignFromRow,
  defaultCampaign,
  fetchTenantRowServer,
} from "@/lib/campaignState";
import { DEFAULT_TENANT_ID, sanitizeTenantId, tokensFromThemeConfig } from "@/lib/tenant";
import { buildThemeCss } from "@/lib/themeCss";

export const dynamic = "force-dynamic";

type TenantLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
};

async function loadTenant(tenant: string) {
  const id = sanitizeTenantId(tenant);
  if (!id) return null;
  const row = await fetchTenantRowServer(id);
  return {
    id,
    campaign: row ? campaignFromRow(row) : defaultCampaign(id),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant } = await params;
  const loaded = await loadTenant(tenant);
  const campaign = loaded?.campaign ?? defaultCampaign(loaded?.id);
  return {
    title: campaign.location
      ? `${campaign.brandName} · ${campaign.location}`
      : campaign.brandName,
    description: tenantConfig.brand.tagline,
  };
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Viewport> {
  const { tenant } = await params;
  const loaded = await loadTenant(tenant);
  const theme = tokensFromThemeConfig(
    (loaded?.campaign ?? defaultCampaign(loaded?.id)).themeConfig,
  );
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: theme.primary,
    viewportFit: "cover",
  };
}

export default async function TenantLayout({
  children,
  params,
}: TenantLayoutProps) {
  const { tenant } = await params;
  const loaded = await loadTenant(tenant);
  if (!loaded) {
    redirect(`/${DEFAULT_TENANT_ID}`);
  }

  const theme = tokensFromThemeConfig(loaded.campaign.themeConfig);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: buildThemeCss(theme) }} />
      <TenantProvider tenantId={loaded.id} initial={loaded.campaign}>
        {children}
      </TenantProvider>
    </>
  );
}
