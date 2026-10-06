import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type GuestTableContext = {
  sessionId: string;
  tableId: string;
  tableName: string;
  venueId: string;
  venueSlug: string;
  gameType: string | null;
  gameStartedAt: string | null;
  venueVerified: boolean;
  verificationExpiresAt: string | null;
  verificationMethod: string | null;
};

export type VenueVerificationStatus =
  | "joined"
  | "invalid_request"
  | "invalid_table"
  | "venue_location_unconfigured"
  | "location_required"
  | "invalid_location"
  | "inaccurate_location"
  | "outside_venue"
  | "active_session_required";

export type JoinGuestTableResult =
  | { ok: true; table: GuestTableContext }
  | {
      ok: false;
      status: Exclude<VenueVerificationStatus, "joined">;
      table?: GuestTableContext;
    };

type GuestTableRow = {
  session_id: string;
  table_id: string;
  table_name: string;
  venue_id: string;
  venue_slug: string;
  game_type?: string | null;
  game_started_at?: string | null;
  venue_verified?: boolean;
  verification_expires_at?: string | null;
  verification_method?: string | null;
};

type JoinGuestTableRow = GuestTableRow & {
  verification_status: VenueVerificationStatus;
};

function tableContext(row: GuestTableRow): GuestTableContext {
  return {
    sessionId: row.session_id,
    tableId: row.table_id,
    tableName: row.table_name,
    venueId: row.venue_id,
    venueSlug: row.venue_slug,
    gameType: row.game_type ?? null,
    gameStartedAt: row.game_started_at ?? null,
    venueVerified: row.venue_verified ?? false,
    verificationExpiresAt: row.verification_expires_at ?? null,
    verificationMethod: row.verification_method ?? null,
  };
}

function verificationResult(data: unknown): JoinGuestTableResult {
  const row = Array.isArray(data)
    ? (data[0] as JoinGuestTableRow | undefined)
    : undefined;
  if (!row) return { ok: false, status: "invalid_request" };
  if (row.verification_status !== "joined") {
    const hasTableContext =
      typeof row.session_id === "string" &&
      typeof row.table_id === "string" &&
      typeof row.table_name === "string" &&
      typeof row.venue_id === "string" &&
      typeof row.venue_slug === "string";
    return {
      ok: false,
      status: row.verification_status,
      ...(hasTableContext ? { table: tableContext(row) } : {}),
    };
  }
  return { ok: true, table: tableContext(row) };
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function joinGuestTable(input: {
  guestId: string;
  venueSlug: string;
  publicToken: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
}): Promise<JoinGuestTableResult> {
  if (!isUuid(input.guestId) || !isUuid(input.publicToken)) {
    return { ok: false, status: "invalid_request" };
  }

  const { data, error } = await getSupabaseAdmin().rpc("join_guest_table", {
    p_guest_id: input.guestId,
    p_venue_slug: input.venueSlug,
    p_public_token: input.publicToken,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_accuracy_m: input.accuracy ?? null,
  });
  if (error) throw error;

  return verificationResult(data);
}

export async function reverifyGuestVenue(input: {
  guestId: string;
  venueSlug: string;
  latitude: number;
  longitude: number;
  accuracy: number;
}): Promise<JoinGuestTableResult> {
  if (!isUuid(input.guestId)) {
    return { ok: false, status: "invalid_request" };
  }

  const { data, error } = await getSupabaseAdmin().rpc(
    "reverify_guest_venue",
    {
      p_guest_id: input.guestId,
      p_venue_slug: input.venueSlug,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_accuracy_m: input.accuracy,
    },
  );
  if (error) throw error;
  return verificationResult(data);
}

export async function touchGuestTable(input: {
  guestId: string;
  venueSlug: string;
  action?: "touch" | "start" | "end";
  nickname?: string | null;
  gameType?: string | null;
}): Promise<GuestTableContext | null> {
  if (!isUuid(input.guestId)) return null;

  const { data, error } = await getSupabaseAdmin().rpc(
    "touch_guest_table_session",
    {
      p_guest_id: input.guestId,
      p_venue_slug: input.venueSlug,
      p_action: input.action ?? "touch",
      p_nickname: input.nickname?.trim().slice(0, 32) || null,
      p_game_type: input.gameType?.trim().slice(0, 64) || null,
    },
  );
  if (error) throw error;

  const row = Array.isArray(data) ? (data[0] as GuestTableRow | undefined) : undefined;
  return row ? tableContext(row) : null;
}
