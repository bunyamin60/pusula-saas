"use client";

import { useEffect, useRef, useState } from "react";
import { useDuel } from "@/components/DuelProvider";
import {
  readTableCodeFromLocation,
  reverifyActiveVenueSession,
  syncGuestTableSession,
  verifyVenueTableEntry,
  type VenueEntryFailureReason,
} from "@/lib/tableSession";

const ENTRY_ERROR_MESSAGES: Partial<Record<VenueEntryFailureReason, string>> = {
  invalid_table: "Bu masa bulunamadı veya kullanım dışı.",
  venue_location_unconfigured: "Mekan konum doğrulaması henüz ayarlanmamış.",
  location_required: "Mekan doğrulaması gerekli. Konum bilgisi alınamadı.",
  invalid_location: "Mekan doğrulaması gerekli. Konum bilgisi geçerli değil.",
  location_permission_denied:
    "Mekan doğrulaması gerekli. Tarayıcı ayarlarından konum iznini açın.",
  location_unavailable: "Mekan doğrulaması gerekli. Konum bilgisi alınamadı.",
  location_timeout: "Mekan doğrulaması gerekli. Konum alınırken süre doldu.",
  inaccurate_location: "Mekan doğrulaması gerekli. Konum yeterince hassas değil.",
  outside_venue: "Mekan doğrulaması gerekli. Mekanın yakınında görünmüyorsunuz.",
  active_session_required: "Aktif masa oturumu bulunamadı. Masa QR'ını okutun.",
  verification_failed: "Mekan doğrulaması tamamlanamadı.",
};

/** Keeps the server-validated V2 table session alive for the current guest. */
export function TableSessionBootstrap({
  onVenueVerificationChange,
}: {
  onVenueVerificationChange: (venueVerified: boolean) => void;
}) {
  const { tenantId, player } = useDuel();
  const [entryError, setEntryError] = useState<VenueEntryFailureReason | null>(null);
  const initialVerificationWarning = useRef<VenueEntryFailureReason | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("tableStatus");
    const warning = url.searchParams.get("venueVerification") as
      | VenueEntryFailureReason
      | null;
    if (status || warning) {
      url.searchParams.delete("tableStatus");
      url.searchParams.delete("venueVerification");
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    }
    const entryIssue =
      warning && ENTRY_ERROR_MESSAGES[warning]
        ? warning
        : status === "invalid" || status === "invalid_table"
          ? "invalid_table"
          : null;
    if (!entryIssue) return;
    if (warning) initialVerificationWarning.current = entryIssue;
    const showTimer = window.setTimeout(() => setEntryError(entryIssue), 0);
    const hideTimer = window.setTimeout(() => setEntryError(null), 4500);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (!tenantId || !player.clientId) return;
    let alive = true;
    let legacyPublicToken = readTableCodeFromLocation();
    let syncInFlight = false;
    let syncFailureCount = 0;
    let nextSyncAttemptAt = 0;
    let reverifyInFlight = false;
    let nextReverifyAttemptAt = initialVerificationWarning.current
      ? Date.now() + 60_000
      : 0;

    const ping = async () => {
      if (!alive || document.visibilityState !== "visible") return;
      if (legacyPublicToken) {
        const publicToken = legacyPublicToken;
        legacyPublicToken = null;
        const result = await verifyVenueTableEntry({ tenantId, publicToken });
        if (alive) {
          if (result.ok) {
            onVenueVerificationChange(result.table.venueVerified === true);
            if (result.warning) {
              setEntryError(result.warning);
              window.setTimeout(() => {
                if (alive) setEntryError(null);
              }, 4500);
            }
          } else {
            onVenueVerificationChange(false);
            setEntryError(result.reason);
            window.setTimeout(() => {
              if (alive) setEntryError(null);
            }, 4500);
          }
        }
        return;
      }
      if (syncInFlight || Date.now() < nextSyncAttemptAt) return;

      syncInFlight = true;
      const session = await syncGuestTableSession({
        tenantId,
        action: "touch",
        nickname: player.nickname,
      }).finally(() => {
        syncInFlight = false;
      });

      if (alive && !session) {
        syncFailureCount += 1;
        const retryDelay = Math.min(
          30_000 * 2 ** (syncFailureCount - 1),
          5 * 60_000,
        );
        nextSyncAttemptAt = Date.now() + retryDelay;
        onVenueVerificationChange(false);
        setEntryError("verification_failed");
        window.setTimeout(() => {
          if (alive) setEntryError(null);
        }, 4500);
        return;
      }

      if (alive && session) {
        syncFailureCount = 0;
        nextSyncAttemptAt = 0;
        const verified = session.table?.venueVerified === true;
        onVenueVerificationChange(verified);
        if (verified) {
          nextReverifyAttemptAt = 0;
          return;
        }
        if (
          !session.table ||
          reverifyInFlight ||
          Date.now() < nextReverifyAttemptAt
        ) {
          return;
        }

        reverifyInFlight = true;
        const result = await reverifyActiveVenueSession({ tenantId });
        reverifyInFlight = false;
        if (!alive) return;
        if (result.ok) {
          const reverified = result.table.venueVerified === true;
          nextReverifyAttemptAt = reverified ? 0 : Date.now() + 60_000;
          onVenueVerificationChange(reverified);
          if (reverified) {
            setEntryError(null);
          } else {
            setEntryError(result.warning ?? "verification_failed");
            window.setTimeout(() => {
              if (alive) setEntryError(null);
            }, 4500);
          }
          return;
        }

        nextReverifyAttemptAt = Date.now() + 60_000;
        onVenueVerificationChange(false);
        setEntryError(result.reason);
        window.setTimeout(() => {
          if (alive) setEntryError(null);
        }, 4500);
      }
    };

    void ping();
    const timer = window.setInterval(() => void ping(), 30_000);
    const onVisibilityChange = () => void ping();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [onVenueVerificationChange, tenantId, player.clientId, player.nickname]);

  if (!entryError) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-5 top-5 z-[100] mx-auto max-w-sm rounded-2xl bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lift"
    >
      {ENTRY_ERROR_MESSAGES[entryError] ?? "Mekan doğrulaması tamamlanamadı."}
    </div>
  );
}
