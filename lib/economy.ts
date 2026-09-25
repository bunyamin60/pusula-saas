import { getSupabase } from "@/lib/supabase";

export const XP_DAILY_CAP = 100;
export const STAMP_GOAL = 6;
export const STAMP_CODE_TTL_MS = 3 * 60_000;
export const STAMP_COOLDOWN_MS = 12 * 60 * 60_000;

export type VenueMode = "masa" | "kasa";

export type XpAwardResult =
  | {
      ok: true;
      capped: boolean;
      granted: number;
      computed?: number;
      xp_total: number;
      xp_day_earned: number;
      daily_cap: number;
      reason?: string;
    }
  | { ok: false; reason: string };

export type StampRequestPayload = {
  id: string;
  code: string;
  table_label: string | null;
  expires_at: string;
  status?: string;
  venue_mode?: VenueMode;
};

export type EconomyStatus = {
  ok: true;
  venue_mode: VenueMode;
  xp_total: number;
  xp_day_earned: number;
  daily_cap: number;
  stamp_count: number;
  stamp_goal: number;
  stamp_cooldown_until: string | null;
  pending_request: StampRequestPayload | null;
};

export type XpConfigRow = {
  id: string;
  tenant_id: string;
  activity_name: string;
  label: string;
  base_xp: number;
  multiplier: number;
  max_xp_per_action: number;
  enabled: boolean;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

/** Client NEVER sends XP amount — only activity + optional score. */
export async function awardXp(input: {
  tenantId: string;
  clientId: string;
  activityName: string;
  score?: number | null;
}): Promise<XpAwardResult> {
  try {
    return await postJson<XpAwardResult>("/api/economy/xp", {
      tenantId: input.tenantId,
      clientId: input.clientId,
      activityName: input.activityName,
      score: input.score ?? null,
    });
  } catch {
    return { ok: false, reason: "offline" };
  }
}

export async function fetchEconomyStatus(
  tenantId: string,
  clientId: string,
): Promise<EconomyStatus | null> {
  try {
    const url = `/api/economy/status?tenantId=${encodeURIComponent(tenantId)}&clientId=${encodeURIComponent(clientId)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as EconomyStatus;
  } catch {
    return null;
  }
}

export async function createStampRequest(input: {
  tenantId: string;
  clientId: string;
  tableLabel?: string | null;
}): Promise<
  | { ok: true; request: StampRequestPayload }
  | { ok: false; reason: string; retry_at?: string; venue_mode?: VenueMode }
> {
  try {
    return await postJson("/api/economy/stamps/request", input);
  } catch {
    return { ok: false, reason: "offline" };
  }
}

export async function approveStampRequest(input: {
  tenantId: string;
  requestId: string;
  adminPassword: string;
}): Promise<{ ok: true; stamp_count: number } | { ok: false; reason: string }> {
  try {
    return await postJson("/api/economy/stamps/approve", input);
  } catch {
    return { ok: false, reason: "offline" };
  }
}

export async function redeemStampReward(input: {
  tenantId: string;
  clientId: string;
}): Promise<
  | {
      ok: true;
      stamp_count: number;
      proof: { id: string; code: string; expires_at: string };
    }
  | { ok: false; reason: string; stamp_count?: number; stamp_goal?: number }
> {
  try {
    return await postJson("/api/economy/stamps/redeem", input);
  } catch {
    return { ok: false, reason: "offline" };
  }
}

export async function listPendingStampRequests(
  tenantId: string,
): Promise<StampRequestPayload[]> {
  try {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("stamp_requests")
      .select("id, code, table_label, expires_at, status")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(40);
    if (error || !Array.isArray(data)) return [];
    return data as StampRequestPayload[];
  } catch {
    return [];
  }
}

export function subscribeStampRequests(
  tenantId: string,
  onChange: () => void,
): () => void {
  const supabase = getSupabase();
  if (!supabase || !tenantId) return () => undefined;
  const channel = supabase
    .channel(`stamp_requests:${tenantId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "stamp_requests",
        filter: `tenant_id=eq.${tenantId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function fetchXpConfigs(tenantId: string): Promise<XpConfigRow[]> {
  try {
    const res = await fetch(
      `/api/economy/xp-configs?tenantId=${encodeURIComponent(tenantId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { configs?: XpConfigRow[] };
    return json.configs ?? [];
  } catch {
    return [];
  }
}

export async function saveXpConfig(input: {
  tenantId: string;
  adminPassword: string;
  config: Partial<XpConfigRow> & { id: string };
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    return await postJson("/api/economy/xp-configs", input);
  } catch {
    return { ok: false, reason: "offline" };
  }
}

export function msUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, t - Date.now());
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
