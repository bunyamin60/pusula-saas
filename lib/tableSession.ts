import { getSupabase } from "@/lib/supabase";
import { tenantConfig } from "@/config/tenant.config";

export type ActiveTable = {
  code: string;
  label: string;
  sessionId?: string;
  venueId?: string;
  venueVerified?: boolean;
  verificationExpiresAt?: string;
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
      venueId: parsed.venueId,
      venueVerified: parsed.venueVerified,
      verificationExpiresAt: parsed.verificationExpiresAt,
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

export function clearCachedTable(tenantId: string): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    window.localStorage.removeItem(storageKey(tenantId));
  } catch {
    // Storage is optional on locked-down browsers.
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

export type VenueEntryFailureReason =
  | "invalid_request"
  | "invalid_table"
  | "venue_location_unconfigured"
  | "location_required"
  | "invalid_location"
  | "inaccurate_location"
  | "outside_venue"
  | "active_session_required"
  | "location_permission_denied"
  | "location_unavailable"
  | "location_timeout"
  | "verification_failed";

export type VenueEntryResult =
  | {
      ok: true;
      guestId: string;
      table: ActiveTable;
      warning?: VenueEntryFailureReason;
    }
  | {
      ok: false;
      reason: VenueEntryFailureReason;
      guestId?: string;
      table?: ActiveTable;
    };

type VerifiedTablePayload = {
  sessionId: string;
  tableId: string;
  tableName: string;
  venueId: string;
  venueVerified: boolean;
  verificationExpiresAt: string | null;
};

function activeTableFromPayload(table: VerifiedTablePayload): ActiveTable {
  return {
    code: table.tableId,
    label: table.tableName,
    sessionId: table.sessionId,
    venueId: table.venueId,
    venueVerified: table.venueVerified,
    verificationExpiresAt: table.verificationExpiresAt ?? undefined,
  };
}

function softEntryFrom(
  tenantId: string,
  entry: Extract<VenueEntryResult, { ok: false }>,
  warning: VenueEntryFailureReason,
): VenueEntryResult {
  if (!entry.guestId || !entry.table) return { ok: false, reason: warning };
  const table = { ...entry.table, venueVerified: false };
  writeCachedTable(tenantId, table);
  return { ok: true, guestId: entry.guestId, table, warning };
}

function isSoftVenueFailure(reason: VenueEntryFailureReason): boolean {
  return (
    reason === "venue_location_unconfigured" ||
    reason === "location_required" ||
    reason === "invalid_location" ||
    reason === "inaccurate_location" ||
    reason === "outside_venue" ||
    reason === "location_permission_denied" ||
    reason === "location_unavailable" ||
    reason === "location_timeout"
  );
}

async function requestVenueEntry(input: {
  tenantId: string;
  publicToken?: string;
  location?: { latitude: number; longitude: number; accuracy: number };
}): Promise<VenueEntryResult> {
  try {
    const response = await fetch("/api/guest/table/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        tenantId: input.tenantId,
        ...(input.publicToken ? { publicToken: input.publicToken } : {}),
        ...(input.location ?? {}),
      }),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      guestId?: string;
      reason?: VenueEntryFailureReason;
      warning?: VenueEntryFailureReason;
      table?: VerifiedTablePayload;
    };
    const table = payload.table
      ? activeTableFromPayload(payload.table)
      : undefined;
    if (!response.ok || !payload.ok || !payload.guestId || !table) {
      if (table) writeCachedTable(input.tenantId, table);
      return {
        ok: false,
        reason: payload.reason ?? "verification_failed",
        ...(payload.guestId ? { guestId: payload.guestId } : {}),
        ...(table ? { table } : {}),
      };
    }

    writeCachedTable(input.tenantId, table);
    return {
      ok: true,
      guestId: payload.guestId,
      table,
      ...(payload.warning ? { warning: payload.warning } : {}),
    };
  } catch {
    return { ok: false, reason: "verification_failed" };
  }
}

function readBrowserLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("location_unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === 1) reject(new Error("location_permission_denied"));
        else if (error.code === 3) reject(new Error("location_timeout"));
        else reject(new Error("location_unavailable"));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

export async function verifyVenueTableEntry(input: {
  tenantId: string;
  publicToken: string;
}): Promise<VenueEntryResult> {
  const publicToken = normalizeTableCode(input.publicToken);
  if (!input.tenantId || !publicToken) {
    return { ok: false, reason: "invalid_request" };
  }

  const existing = await requestVenueEntry({
    tenantId: input.tenantId,
    publicToken,
  });
  if (existing.ok || existing.reason !== "location_required") return existing;

  try {
    const location = await readBrowserLocation();
    const verified = await requestVenueEntry({
      tenantId: input.tenantId,
      publicToken,
      location,
    });
    if (!verified.ok && isSoftVenueFailure(verified.reason)) {
      return softEntryFrom(input.tenantId, existing, verified.reason);
    }
    return verified;
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "location_unavailable";
    if (
      reason === "location_permission_denied" ||
      reason === "location_timeout" ||
      reason === "location_unavailable"
    ) {
      return softEntryFrom(input.tenantId, existing, reason);
    }
    return softEntryFrom(input.tenantId, existing, "location_unavailable");
  }
}

export async function reverifyActiveVenueSession(input: {
  tenantId: string;
}): Promise<VenueEntryResult> {
  if (!input.tenantId) return { ok: false, reason: "invalid_request" };
  try {
    const location = await readBrowserLocation();
    return await requestVenueEntry({ tenantId: input.tenantId, location });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "location_unavailable";
    if (
      reason === "location_permission_denied" ||
      reason === "location_timeout" ||
      reason === "location_unavailable"
    ) {
      return { ok: false, reason };
    }
    return { ok: false, reason: "location_unavailable" };
  }
}

export async function joinVenueTable(input: {
  tenantId: string;
  tableCode: string;
  clientId: string;
  nickname?: string;
}): Promise<ActiveTable | null> {
  void input.clientId;
  void input.nickname;
  const result = await verifyVenueTableEntry({
    tenantId: input.tenantId,
    publicToken: input.tableCode,
  });
  return result.ok ? result.table : null;
}

type GuestSessionPayload = {
  ok?: boolean;
  guestId?: string;
  table?: {
    sessionId?: string;
    tableId?: string;
    tableName?: string;
    venueId?: string;
    venueVerified?: boolean;
    verificationExpiresAt?: string | null;
  } | null;
};

export async function syncGuestTableSession(input: {
  tenantId: string;
  action?: "touch" | "start" | "end";
  nickname?: string;
  gameType?: string;
}): Promise<{ guestId: string; table: ActiveTable | null } | null> {
  if (!input.tenantId) return null;
  try {
    const response = await fetch("/api/guest/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        tenantId: input.tenantId,
        action: input.action ?? "touch",
        nickname: input.nickname ?? null,
        gameType: input.gameType ?? null,
      }),
    });
    const payload = (await response.json()) as GuestSessionPayload;
    if (!response.ok || !payload.ok || !payload.guestId) return null;

    const table =
      payload.table?.sessionId && payload.table.tableId && payload.table.tableName
        ? {
            code: payload.table.tableId,
            label: payload.table.tableName,
            sessionId: payload.table.sessionId,
            venueId: payload.table.venueId,
            venueVerified: payload.table.venueVerified,
            verificationExpiresAt:
              payload.table.verificationExpiresAt ?? undefined,
          }
        : null;
    if (table) writeCachedTable(input.tenantId, table);
    else clearCachedTable(input.tenantId);
    return { guestId: payload.guestId, table };
  } catch {
    return null;
  }
}

export async function startVenueTableGame(input: {
  tenantId: string;
  clientId: string;
  gameType: string;
}): Promise<void> {
  void input.clientId;
  if (!input.tenantId || !input.gameType) return;
  await syncGuestTableSession({
    tenantId: input.tenantId,
    action: "start",
    gameType: input.gameType,
  });
}

export async function endVenueTableGame(input: {
  tenantId: string;
  clientId: string;
}): Promise<void> {
  void input.clientId;
  if (!input.tenantId) return;
  await syncGuestTableSession({ tenantId: input.tenantId, action: "end" });
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
