export const MERCHANT_TABLE_POLL_INTERVAL_MS = 15_000;
export const ACTIVE_TABLE_FRESHNESS_MS = 2 * 60 * 1000;

export type MerchantTableMonitorRow = {
  tableId: string;
  tableName: string;
  state: "active" | "empty";
  activeGuestCount: number;
  gameTypes: string[];
  lastActivityAt: string | null;
  activeSince: string | null;
};

export type MerchantTableMonitor = {
  updatedAt: string;
  freshnessSeconds: number;
  summary: {
    totalTables: number;
    activeTables: number;
    activeGuests: number;
  };
  tables: MerchantTableMonitorRow[];
};

export type MerchantTableRecord = {
  id: string;
  name: string;
  created_at: string;
};

export type MerchantGuestTableSessionRecord = {
  id: string;
  guest_id: string;
  venue_table_id: string;
  status: string;
  game_type: string | null;
  started_at: string;
  last_seen_at: string;
};

export function buildMerchantTableMonitor(
  tableRecords: MerchantTableRecord[],
  sessionRecords: MerchantGuestTableSessionRecord[],
  nowMs = Date.now(),
): MerchantTableMonitor {
  const cutoffMs = nowMs - ACTIVE_TABLE_FRESHNESS_MS;
  const sessionsByTable = new Map<string, MerchantGuestTableSessionRecord[]>();

  for (const session of sessionRecords) {
    const lastSeenMs = Date.parse(session.last_seen_at);
    if (
      session.status !== "active" ||
      !Number.isFinite(lastSeenMs) ||
      lastSeenMs < cutoffMs
    ) {
      continue;
    }
    const current = sessionsByTable.get(session.venue_table_id) ?? [];
    current.push(session);
    sessionsByTable.set(session.venue_table_id, current);
  }

  const tables = tableRecords.map<MerchantTableMonitorRow>((table) => {
    const sessions = sessionsByTable.get(table.id) ?? [];
    const guestIds = new Set(sessions.map((session) => session.guest_id));
    const gameTypes = Array.from(
      new Set(
        sessions
          .map((session) => session.game_type?.trim())
          .filter((gameType): gameType is string => Boolean(gameType)),
      ),
    ).sort((left, right) => left.localeCompare(right, "tr"));
    const lastSeenTimes = sessions
      .map((session) => Date.parse(session.last_seen_at))
      .filter(Number.isFinite);
    const startedTimes = sessions
      .map((session) => Date.parse(session.started_at))
      .filter(Number.isFinite);

    return {
      tableId: table.id,
      tableName: table.name,
      state: guestIds.size > 0 ? "active" : "empty",
      activeGuestCount: guestIds.size,
      gameTypes,
      lastActivityAt:
        lastSeenTimes.length > 0
          ? new Date(Math.max(...lastSeenTimes)).toISOString()
          : null,
      activeSince:
        startedTimes.length > 0
          ? new Date(Math.min(...startedTimes)).toISOString()
          : null,
    };
  });

  return {
    updatedAt: new Date(nowMs).toISOString(),
    freshnessSeconds: ACTIVE_TABLE_FRESHNESS_MS / 1000,
    summary: {
      totalTables: tables.length,
      activeTables: tables.filter((table) => table.state === "active").length,
      activeGuests: tables.reduce(
        (total, table) => total + table.activeGuestCount,
        0,
      ),
    },
    tables,
  };
}

export type MerchantTableMonitorQuery =
  | { ok: true; data: MerchantTableMonitor }
  | { ok: false; reason: "unauthenticated" | "unauthorized" | "failed" };

export async function fetchMerchantTableMonitor(
  venueSlug: string,
  signal?: AbortSignal,
): Promise<MerchantTableMonitorQuery> {
  try {
    const response = await fetch(
      `/api/merchant/tables?venue=${encodeURIComponent(venueSlug)}`,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
      },
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      reason?: "unauthenticated" | "unauthorized" | "failed";
      data?: MerchantTableMonitor;
    };
    if (!response.ok || !payload.ok || !payload.data) {
      return { ok: false, reason: payload.reason ?? "failed" };
    }
    return { ok: true, data: payload.data };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
