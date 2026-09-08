import type { Metadata } from "next";
import type { ReactNode } from "react";
import { tenantConfig } from "@/config/tenant.config";
import {
  campaignFromRow,
  defaultCampaign,
  fetchTenantRowServer,
} from "@/lib/campaignState";
import { sanitizeTenantId } from "@/lib/tenant";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant } = await params;
  const id = sanitizeTenantId(tenant);
  const row = id ? await fetchTenantRowServer(id) : null;
  const campaign = row ? campaignFromRow(row) : defaultCampaign(id ?? undefined);
  return {
    title: `${tenantConfig.copy.admin.title} · ${campaign.brandName}`,
    robots: { index: false, follow: false },
  };
}

export default function TenantAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
