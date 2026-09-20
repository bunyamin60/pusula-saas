"use client";

import { useEffect } from "react";
import { useDuel } from "@/components/DuelProvider";
import {
  joinVenueTable,
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
    const fromUrl = readTableCodeFromLocation();
    const cached = readCachedTable(tenantId);
    const code = fromUrl || cached?.code;
    if (!code) return;
    void joinVenueTable({
      tenantId,
      tableCode: code,
      clientId: player.clientId,
      nickname: player.nickname,
    });
  }, [tenantId, player.clientId, player.nickname]);

  return null;
}
