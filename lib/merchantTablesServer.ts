import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MerchantAccess } from "@/lib/merchantAuth";
import {
  ACTIVE_TABLE_FRESHNESS_MS,
  buildMerchantTableMonitor,
  type MerchantGuestTableSessionRecord,
  type MerchantTableMonitor,
  type MerchantTableRecord,
} from "@/lib/merchantTables";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function getMerchantTableMonitor(
  access: MerchantAccess,
  ownerClient: SupabaseClient,
  now = new Date(),
): Promise<MerchantTableMonitor> {
  const { data: tableData, error: tableError } = await ownerClient
    .from("venue_tables")
    .select("id, name, created_at")
    .eq("venue_id", access.venue.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .order("name", { ascending: true });

  if (tableError) throw new Error("merchant-tables-read-failed");

  const tables = (tableData ?? []) as MerchantTableRecord[];
  if (tables.length === 0) {
    return buildMerchantTableMonitor([], [], now.getTime());
  }

  const cutoff = new Date(
    now.getTime() - ACTIVE_TABLE_FRESHNESS_MS,
  ).toISOString();
  const tableIds = tables.map((table) => table.id);
  const { data: sessionData, error: sessionError } = await getSupabaseAdmin()
    .from("guest_table_sessions")
    .select(
      "id, guest_id, venue_table_id, status, game_type, started_at, last_seen_at",
    )
    .in("venue_table_id", tableIds)
    .eq("status", "active")
    .gte("last_seen_at", cutoff);

  if (sessionError) throw new Error("merchant-table-sessions-read-failed");

  return buildMerchantTableMonitor(
    tables,
    (sessionData ?? []) as MerchantGuestTableSessionRecord[],
    now.getTime(),
  );
}
