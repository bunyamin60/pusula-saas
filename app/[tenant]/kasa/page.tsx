import { redirect } from "next/navigation";
import { sanitizeTenantId } from "@/lib/tenant";

export default async function TenantKasaPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const id = sanitizeTenantId(tenant);
  redirect(`/${id || tenant}/admin`);
}
