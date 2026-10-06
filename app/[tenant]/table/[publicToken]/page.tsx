import { redirect } from "next/navigation";
import { VenueVerificationGate } from "@/components/VenueVerificationGate";
import { DEFAULT_TENANT_ID, sanitizeTenantId } from "@/lib/tenant";

type TablePageProps = {
  params: Promise<{ tenant: string; publicToken: string }>;
};

export default async function TablePage({ params }: TablePageProps) {
  const { tenant: rawTenant, publicToken } = await params;
  const tenant = sanitizeTenantId(rawTenant)?.toLowerCase();
  if (!tenant) redirect(`/${DEFAULT_TENANT_ID}?tableStatus=invalid_table`);

  return <VenueVerificationGate tenantId={tenant} publicToken={publicToken} />;
}
