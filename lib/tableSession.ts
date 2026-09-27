import { getSupabase } from "@/lib/supabase";
import { tenantConfig } from "@/config/tenant.config";

export type ActiveTable = {
  code: string;
  label: string;
  sessionId?: string;
};

function storageKey(tenantId: string): string {
  return `venue_table_${tenantId}`;
}

/** Normalize QR values: "4" | "m4" | "masa=4" | "Masa #4" → code "4". */
export function normalizeTableCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^masa[\s#_:-]*/i, "");
  value = value.replace(/^m[\s#_:-]*/i, "");
  value = value.replace(/[^a-z0-9_-]/g, "");
  return value || null;
}

export function formatTableLabel(code: string): string {
  if (/^\d+$/.test(code)) return `Masa #${code}`;
  return `Masa ${code}`;
}

export function readCachedTable(tenantId: string): ActiveTable | null {
  if (typeof window === "undefined" || !tenantId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveTable>;
    if (!parsed.code || !parsed.label) return null;
    return {
      code: parsed.code,
      label: parsed.label,
      sessionId: parsed.sessionId,
    };
  } catch {
    return null;
  }
}

export function writeCachedTable(tenantId: string, table: ActiveTable): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    window.localStorage.setItem(storageKey(tenantId), JSON.stringify(table));
  } catch {
    // ignore
  }
}

/** Display label for UI / coupons — QR cache, else brand fallback. */
export function getActiveTableLabel(tenantId: string): string {
  const cached = readCachedTable(tenantId);
  if (cached?.label) return cached.label;
  return (
    tenantConfig.brand.tableName.trim() ||
    tenantConfig.copy.landing.gameShell.tableFallback
  );
}

export function getActiveTableCode(tenantId: string): string | null {
  return readCachedTable(tenantId)?.code ?? null;
}

/** Read tableId | masa | m from the current URL (and strip them from the bar). */
export function readTableCodeFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const raw =
      url.searchParams.get("tableId") ||
      url.searchParams.get("masa") ||
      url.searchParams.get("m");
    const code = normalizeTableCode(raw);
    if (code) {
      url.searchParams.delete("tableId");
      url.searchParams.delete("masa");
      url.searchParams.delete("m");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    return code;
  } catch {
    return null;
  }
}

export async function joinVenueTable(input: {
  tenantId: string;
  tableCode: string;
  clientId: string;
  nickname?: string;
}): Promise<ActiveTable | null> {
  const code = normalizeTableCode(input.tableCode);
  if (!code || !input.tenantId) return null;

  const label = formatTableLabel(code);
  const fallback: ActiveTable = { code, label };

  try {
    const res = await fetch("/api/economy/tables/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        tenantId: input.tenantId,
        action: "join",
        tableCode: code,
        nickname: input.nickname ?? null,
      }),
    });
    const payload = (await res.json()) as {
      ok?: boolean;
      table?: {
        session_id?: string;
        table_code?: string;
        table_label?: string;
      } | null;
    };
    if (!res.ok || !payload.ok || !payload.table) {
      writeCachedTable(input.tenantId, fallback);
      return fallback;
    }
    const next: ActiveTable = {
      code: payload.table.table_code || code,
      label: payload.table.table_label || label,
      sessionId: payload.table.session_id,
    };
    writeCachedTable(input.tenantId, next);
    return next;
  } catch {
    writeCachedTable(input.tenantId, fallback);
    return fallback;
  }
}

export async function startVenueTableGame(input: {
  tenantId: string;
  clientId: string;
  gameType: string;
}): Promise<void> {
  void input.clientId;
  try {
    if (!input.tenantId || !input.gameType) return;
    await fetch("/api/economy/tables/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        tenantId: input.tenantId,
        action: "start",
        gameType: input.gameType,
      }),
    });
  } catch {
    // Admin live view is best-effort.
  }
}

export async function endVenueTableGame(input: {
  tenantId: string;
  clientId: string;
}): Promise<void> {
  void input.clientId;
  try {
    if (!input.tenantId) return;
    await fetch("/api/economy/tables/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        tenantId: input.tenantId,
        action: "end",
      }),
    });
  } catch {
    // ignore
  }
}

export type LiveTableSession = {
  sessionId: string;
  tableCode: string;
  tableLabel: string;
  clientId: string;
  nickname: string | null;
  gameType: string | null;
  gameStartedAt: string | null;
  startedAt: string;
  lastSeenAt: string;
  minutesAtTable: number;
  minutesInGame: number | null;
};

const LIVE_TABLE_MS = 2 * 60 * 1000;

export type TableSessionQuery =
  | { ok: true; rows: LiveTableSession[] }
  | { ok: false };

export async function fetchActiveTableSessions(
  tenantId: string,
): Promise<TableSessionQuery> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return { ok: false };
    const { data, error } = await supabase.rpc("get_active_table_sessions", {
      p_tenant_id: tenantId,
    });
    if (error || !Array.isArray(data)) return { ok: false };
    const now = Date.now();
    const rows = (
      data as Array<{
        session_id: string;
        table_code: string;
        table_label: string;
        client_id: string;
        nickname: string | null;
        game_type: string | null;
        game_started_at: string | null;
        started_at: string;
        last_seen_at: string;
        minutes_at_table: number;
        minutes_in_game: number | null;
      }>
    ).map((row) => ({
      sessionId: row.session_id,
      tableCode: row.table_code,
      tableLabel: row.table_label,
      clientId: row.client_id,
      nickname: row.nickname,
      gameType: row.game_type,
      gameStartedAt: row.game_started_at,
      startedAt: row.started_at,
      lastSeenAt: row.last_seen_at,
      minutesAtTable: row.minutes_at_table,
      minutesInGame: row.minutes_in_game,
    })).filter((row) => {
      const seen = Date.parse(row.lastSeenAt);
      return Number.isFinite(seen) && now - seen <= LIVE_TABLE_MS;
    });
    return { ok: true, rows };
  } catch {
    return { ok: false };
  }
}
