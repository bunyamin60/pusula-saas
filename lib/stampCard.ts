import { tenantConfig } from "@/config/tenant.config";
import { registerRewardCoupon } from "@/lib/rewardCoupons";
import { getSupabase } from "@/lib/supabase";

export const STAMP_GOAL = 5;

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

export function makeStampCouponCode(): string {
  const prefix = tenantConfig.playReward.codePrefix;
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}5KAHVE-${n}`;
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

async function persistRemote(
  tenantId: string,
  clientId: string,
  count: number,
  lastCode: string | null,
): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId || !clientId) return;
    await supabase.from("customers").upsert(
      {
        tenant_id: tenantId,
        client_id: clientId,
        stamp_count: count,
        last_coupon_code: lastCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,client_id" },
    );
  } catch {
    // Local card still works if the table is missing.
  }
}

export async function loadStampCard(
  tenantId: string,
  clientId: string,
): Promise<StampCardState> {
  const local = readStampCard(tenantId, clientId);
  const remote = await fetchRemoteCount(tenantId, clientId);
  if (remote == null) return local;
  const next = writeStampCard(tenantId, clientId, {
    count: Math.max(local.count, remote),
    lastCode: local.lastCode,
  });
  if (next.count !== remote) await persistRemote(tenantId, clientId, next.count, next.lastCode);
  return next;
}

export async function confirmStampVisit(input: {
  tenantId: string;
  clientId: string;
  tableId: string;
}): Promise<StampCardState> {
  const current = readStampCard(input.tenantId, input.clientId);
  const nextCount = Math.min(STAMP_GOAL, current.count + 1);
  if (nextCount < STAMP_GOAL) {
    const next = writeStampCard(input.tenantId, input.clientId, {
      count: nextCount,
      lastCode: null,
    });
    await persistRemote(input.tenantId, input.clientId, next.count, next.lastCode);
    return next;
  }

  const code = makeStampCouponCode();
  const rewardText = tenantConfig.copy.landing.stamps.rewarded.replace("{code}", code);
  await registerRewardCoupon({
    tenantId: input.tenantId,
    code,
    tableId: input.tableId,
    rewardText,
  });
  const next = writeStampCard(input.tenantId, input.clientId, {
    count: 0,
    lastCode: code,
  });
  await persistRemote(input.tenantId, input.clientId, 0, code);
  return next;
}
