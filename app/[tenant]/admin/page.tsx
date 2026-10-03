import { MerchantAdminDashboard } from "@/components/MerchantAdminDashboard";
import { MerchantLogin } from "@/components/MerchantLogin";
import { getMerchantAuthState } from "@/lib/merchantAuth";
import { sanitizeTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function TenantAdminPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const venueSlug = sanitizeTenantId(tenant)?.toLowerCase() ?? tenant.toLowerCase();
  const authState = await getMerchantAuthState(venueSlug);

  if (authState.status === "authorized") {
    return <MerchantAdminDashboard access={authState.access} />;
  }

  return (
    <main className="min-h-dvh bg-[var(--bg-canvas)]">
      <MerchantLogin
        venueSlug={venueSlug}
        initialMessage={
          authState.status === "unauthorized"
            ? "Bu oturumun bu mekana erişim yetkisi yok. Başka bir hesapla giriş yapın."
            : undefined
        }
      />
    </main>
  );
}
