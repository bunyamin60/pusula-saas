import { awardXp, STAMP_GOAL as ECONOMY_STAMP_GOAL } from "@/lib/economy";
import { readCustomerProfile } from "@/lib/customerProfile";
import { getSupabase } from "@/lib/supabase";

/** @deprecated Use STAMP_GOAL from @/lib/economy (6). Kept for import compatibility. */
export const STAMP_GOAL = ECONOMY_STAMP_GOAL;

export type StampCardState = {
  count: number;
  lastCode: string | null;
};

const EMPTY: StampCardState = { count: 0, lastCode: null };

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function stampStorageKey(tenantId: string, clientId: string): string {
  return `loyalty_stamps_${tenantId}_${clientId}`;
}

function clampCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(STAMP_GOAL, Math.floor(n)));
}

export function readStampCard(tenantId: string, clientId: string): StampCardState {
  if (!canUseStorage() || !tenantId || !clientId) return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(stampStorageKey(tenantId, clientId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<StampCardState>;
    return {
      count: clampCount(parsed.count),
      lastCode:
        typeof parsed.lastCode === "string" && parsed.lastCode.trim()
          ? parsed.lastCode.trim()
          : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writeStampCard(
  tenantId: string,
  clientId: string,
  next: StampCardState,
): StampCardState {
  const safe: StampCardState = {
    count: clampCount(next.count),
    lastCode: next.lastCode?.trim() || null,
  };
  if (canUseStorage() && tenantId && clientId) {
    try {
      window.localStorage.setItem(
        stampStorageKey(tenantId, clientId),
        JSON.stringify(safe),
      );
    } catch {
      // Private mode may block storage.
    }
  }
  return safe;
}

export function clearStampCard(tenantId: string, clientId?: string): void {
  if (!canUseStorage()) return;
  try {
    if (clientId) {
      window.localStorage.removeItem(stampStorageKey(tenantId, clientId));
      return;
    }
    const prefix = `loyalty_stamps_${tenantId}_`;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(prefix) || key === `loyalty_stamps_${tenantId}`) {
        keys.push(key);
      }
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

async function fetchRemoteCount(
  tenantId: string,
  clientId: string,
): Promise<number | null> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId || !clientId) return null;
    const { data, error } = await supabase
      .from("customers")
      .select("stamp_count")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (error || !data) return null;
    return clampCount((data as { stamp_count?: number }).stamp_count);
  } catch {
    return null;
  }
}

export async function loadStampCard(
  tenantId: string,
  clientId: string,
): Promise<StampCardState> {
  const local = readStampCard(tenantId, clientId);
  const remote = await fetchRemoteCount(tenantId, clientId);
  if (remote == null) return local;
  return writeStampCard(tenantId, clientId, {
    count: remote,
    lastCode: local.lastCode,
  });
}

/**
 * Legacy game hook — no longer grants stamps (anti-cheat).
 * Awards server-validated XP for the given activity instead.
 */
export async function confirmStampVisit(input: {
  tenantId: string;
  clientId: string;
  tableId: string;
  activityName?: string;
  score?: number;
}): Promise<StampCardState> {
  void input.tableId;
  await awardXp({
    tenantId: input.tenantId,
    clientId: input.clientId,
    activityName: input.activityName ?? "mini_oyun",
    score: input.score ?? null,
  });
  return loadStampCard(input.tenantId, input.clientId);
}

export async function syncStampNickname(
  tenantId: string,
  clientId: string,
): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId || !clientId) return;
    const profile = readCustomerProfile();
    if (!profile?.name) return;
    await supabase.from("customers").upsert(
      {
        tenant_id: tenantId,
        client_id: clientId,
        nickname: profile.name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,client_id" },
    );
  } catch {
    // ignore
  }
}
