"use client";

import { useCallback, useEffect, useState } from "react";
import { LocateFixed, MapPin, RefreshCw } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PhoneShell } from "@/components/PhoneShell";
import {
  verifyVenueTableEntry,
  type VenueEntryFailureReason,
  type VenueEntryResult,
} from "@/lib/tableSession";
import { useCampaign } from "@/lib/useCampaign";

const pendingVerifications = new Map<string, Promise<VenueEntryResult>>();

function verifyOnce(tenantId: string, publicToken: string) {
  const key = `${tenantId}:${publicToken}`;
  const existing = pendingVerifications.get(key);
  if (existing) return existing;
  const pending = verifyVenueTableEntry({ tenantId, publicToken }).finally(() => {
    pendingVerifications.delete(key);
  });
  pendingVerifications.set(key, pending);
  return pending;
}

const ERROR_MESSAGES: Record<VenueEntryFailureReason, string> = {
  invalid_request: "QR bağlantısı geçerli değil.",
  invalid_table: "Bu masa bulunamadı veya şu anda kullanım dışı.",
  venue_location_unconfigured:
    "Mekanın konum doğrulaması henüz ayarlanmamış. Lütfen işletme yetkilisine bildirin.",
  location_required: "Devam etmek için konum izni gerekiyor.",
  invalid_location: "Cihazdan geçerli bir konum bilgisi alınamadı.",
  inaccurate_location:
    "Konum yeterince hassas değil. Açık bir alana yaklaşarak tekrar deneyin.",
  outside_venue: "Bu QR yalnızca mekanın yakınındayken kullanılabilir.",
  active_session_required: "Aktif masa oturumu bulunamadı. Masa QR'ını tekrar okutun.",
  location_permission_denied:
    "Konum izni verilmedi. Tarayıcı ayarlarından konum iznini açıp tekrar deneyin.",
  location_unavailable:
    "Konum bilgisi alınamadı. Cihazınızın konum servislerini kontrol edin.",
  location_timeout: "Konum alınırken süre doldu. Lütfen tekrar deneyin.",
  verification_failed: "Doğrulama tamamlanamadı. Lütfen tekrar deneyin.",
};

export function VenueVerificationGate({
  tenantId,
  publicToken,
}: {
  tenantId: string;
  publicToken: string;
}) {
  const campaign = useCampaign();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<VenueEntryFailureReason | null>(null);

  const verify = useCallback(async () => {
    setChecking(true);
    setError(null);
    const result = await verifyOnce(tenantId, publicToken);
    if (result.ok) {
      const params = new URLSearchParams({ tableStatus: "joined" });
      if (result.warning) params.set("venueVerification", result.warning);
      window.location.replace(
        `/${encodeURIComponent(tenantId)}?${params.toString()}`,
      );
      return;
    }
    setError(result.reason);
    setChecking(false);
  }, [publicToken, tenantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void verify(), 0);
    return () => window.clearTimeout(timer);
  }, [verify]);

  if (checking) return <LoadingScreen />;

  return (
    <PhoneShell>
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <section className="w-full rounded-3xl border border-[var(--border)] bg-[var(--card-surface)] p-6 text-center shadow-lift">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--btn-primary)_14%,transparent)] text-[var(--btn-primary)]">
            <MapPin className="size-7" aria-hidden />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-body)]">
            {campaign.brandName}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-[var(--text-headline)]">
            Mekan doğrulaması
          </h1>
          <p role="alert" className="mt-3 text-sm leading-6 text-[var(--text-body)]">
            {error ? ERROR_MESSAGES[error] : "Konumunuz kontrol ediliyor."}
          </p>
          <button
            type="button"
            onClick={() => void verify()}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--btn-primary)] px-5 font-semibold text-[var(--btn-text)] active:scale-[0.98]"
          >
            {error === "location_permission_denied" ? (
              <LocateFixed className="size-5" aria-hidden />
            ) : (
              <RefreshCw className="size-5" aria-hidden />
            )}
            Tekrar dene
          </button>
        </section>
      </main>
    </PhoneShell>
  );
}
