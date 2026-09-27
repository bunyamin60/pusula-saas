"use client";

import { useEffect } from "react";
import { useDuel } from "@/components/DuelProvider";
import {
  getActiveTableLabel,
  joinVenueTable,
  normalizeTableCode,
  readCachedTable,
  readTableCodeFromLocation,
} from "@/lib/tableSession";

/**
 * On guest entry: read ?tableId|masa|m, join Supabase table_sessions,
 * and cache the active masa for UI / rewards / scores.
 */
export function TableSessionBootstrap() {
  const { tenantId, player } = useDuel();

  useEffect(() => {
    if (!tenantId || !player.clientId) return;
    let alive = true;

    const ping = () => {
      if (!alive || document.visibilityState !== "visible") return;
      const code =
        readTableCodeFromLocation() ||
        readCachedTable(tenantId)?.code ||
        normalizeTableCode(getActiveTableLabel(tenantId));
      if (!code) return;
      void joinVenueTable({
        tenantId,
        tableCode: code,
        clientId: player.clientId,
        nickname: player.nickname,
      });
    };

    ping();
    const timer = window.setInterval(ping, 30_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [tenantId, player.clientId, player.nickname]);

  return null;
}
