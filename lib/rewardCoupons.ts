import { getSupabase } from "@/lib/supabase";
import {
  redeemClaimedReward,
  registerClaimedReward,
} from "@/lib/claimedRewards";
import { getActiveTableLabel } from "@/lib/tableSession";

export type RewardCoupon = {
  code: string;
  tableId: string;
  rewardText: string;
  redeemedAt: string | null;
};

export type RedeemCouponResult =
  | { ok: true; coupon: RewardCoupon }
  | { ok: false; reason: "used" | "missing" | "offline"; redeemedAt?: string | null };

export type CouponMetrics = {
  issuedCount: number;
  redeemedCount: number;
  avgDwellMinutes: number | null;
};

type CouponRow = {
  tenant_id?: string | null;
  coupon_code?: string | null;
  table_id?: string | null;
  reward_text?: string | null;
  status?: string | null;
  redeemed_at?: string | null;
  created_at?: string | null;
};

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function statusOf(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function isRedeemed(value: string | null | undefined): boolean {
  return statusOf(value) === "REDEEMED";
}

function mapCoupon(row: CouponRow): RewardCoupon {
  return {
    code: (row.coupon_code ?? "").trim(),
    tableId: row.table_id?.trim() || "",
    rewardText: row.reward_text?.trim() || "",
    redeemedAt: row.redeemed_at ?? null,
  };
}

function startOfTodayIstanbul(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}T00:00:00+03:00`;
}

async function upsertRewardCouponRow(input: {
  tenantId: string;
  code: string;
  tableId?: string | null;
  rewardText?: string | null;
  status: "ACTIVE" | "REDEEMED";
  redeemedAt?: string | null;
}): Promise<CouponRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const payload = {
    tenant_id: input.tenantId,
    coupon_code: input.code,
    table_id: input.tableId?.trim() || null,
    reward_text: input.rewardText?.trim() || null,
    status: input.status,
    redeemed_at:
      input.status === "REDEEMED"
        ? input.redeemedAt ?? new Date().toISOString()
        : null,
  };
  const { data, error } = await supabase
    .from("reward_coupons")
    .upsert(payload, { onConflict: "tenant_id,coupon_code" })
    .select("coupon_code, table_id, reward_text, status, redeemed_at")
    .maybeSingle();
  if (error) return null;
  return data as CouponRow | null;
}

export async function registerRewardCoupon(input: {
  tenantId: string;
  code: string;
  tableId: string;
  rewardText: string;
}): Promise<void> {
  const code = normalizeCode(input.code);
  if (!input.tenantId || !code) return;
  const tableId = input.tableId.trim() || getActiveTableLabel(input.tenantId);

  try {
    await upsertRewardCouponRow({
      tenantId: input.tenantId,
      code,
      tableId,
      rewardText: input.rewardText,
      status: "ACTIVE",
    });
  } catch {
    // Guest coupon still works locally if the kasa table is unreachable.
  }

  await registerClaimedReward({
    ...input,
    tableId,
    code,
  });
}

export async function redeemRewardCoupon(
  tenantId: string,
  rawCode: string,
): Promise<RedeemCouponResult> {
  const code = normalizeCode(rawCode);
  if (!tenantId || !code) return { ok: false, reason: "offline" };

  try {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, reason: "offline" };

    const { data, error } = await supabase
      .from("reward_coupons")
      .select("coupon_code, table_id, reward_text, status, redeemed_at")
      .eq("tenant_id", tenantId)
      .eq("coupon_code", code)
      .maybeSingle();

    if (error) throw error;

    const row = data as CouponRow | null;
    if (row && isRedeemed(row.status)) {
      return {
        ok: false,
        reason: "used",
        redeemedAt: row.redeemed_at ?? null,
      };
    }

    if (row) {
      const redeemedAt = new Date().toISOString();
      const updated = await supabase
        .from("reward_coupons")
        .update({
          status: "REDEEMED",
          redeemed_at: redeemedAt,
        })
        .eq("tenant_id", tenantId)
        .eq("coupon_code", code)
        .select("coupon_code, table_id, reward_text, status, redeemed_at")
        .maybeSingle();

      if (updated.error) throw updated.error;
      void redeemClaimedReward(tenantId, code);
      return {
        ok: true,
        coupon: mapCoupon(
          (updated.data as CouponRow | null) ?? {
            ...row,
            status: "REDEEMED",
            redeemed_at: redeemedAt,
          },
        ),
      };
    }

    const legacy = await redeemClaimedReward(tenantId, code);
    if (legacy.ok) {
      const redeemedAt = new Date().toISOString();
      const synced = await upsertRewardCouponRow({
        tenantId,
        code: legacy.reward.code || code,
        tableId: legacy.reward.tableId,
        rewardText: legacy.reward.rewardText,
        status: "REDEEMED",
        redeemedAt,
      });
      return {
        ok: true,
        coupon: synced
          ? mapCoupon(synced)
          : {
              code: legacy.reward.code || code,
              tableId: legacy.reward.tableId,
              rewardText: legacy.reward.rewardText,
              redeemedAt,
            },
      };
    }
    if (legacy.reason === "used") {
      const redeemedAt = new Date().toISOString();
      await upsertRewardCouponRow({
        tenantId,
        code,
        status: "REDEEMED",
        redeemedAt,
      });
      return { ok: false, reason: "used", redeemedAt };
    }
    return { ok: false, reason: "missing" };
  } catch {
    // Fall through to the previous coupon table.
  }

  const legacy = await redeemClaimedReward(tenantId, code);
  if (legacy.ok) {
    const redeemedAt = new Date().toISOString();
    const synced = await upsertRewardCouponRow({
      tenantId,
      code: legacy.reward.code || code,
      tableId: legacy.reward.tableId,
      rewardText: legacy.reward.rewardText,
      status: "REDEEMED",
      redeemedAt,
    });
    return {
      ok: true,
      coupon: synced
        ? mapCoupon(synced)
        : {
            code: legacy.reward.code || code,
            tableId: legacy.reward.tableId,
            rewardText: legacy.reward.rewardText,
            redeemedAt,
          },
    };
  }
  return { ok: false, reason: legacy.reason };
}

export async function fetchCouponRedemption(
  tenantId: string,
  rawCode: string,
): Promise<{ redeemed: boolean; redeemedAt: string | null }> {
  const code = normalizeCode(rawCode);
  if (!tenantId || !code) return { redeemed: false, redeemedAt: null };
  try {
    const supabase = getSupabase();
    if (!supabase) return { redeemed: false, redeemedAt: null };
    const { data, error } = await supabase
      .from("reward_coupons")
      .select("status, redeemed_at")
      .eq("tenant_id", tenantId)
      .eq("coupon_code", code)
      .maybeSingle();
    if (error || !data) return { redeemed: false, redeemedAt: null };
    const row = data as CouponRow;
    if (!isRedeemed(row.status)) return { redeemed: false, redeemedAt: null };
    return { redeemed: true, redeemedAt: row.redeemed_at ?? null };
  } catch {
    return { redeemed: false, redeemedAt: null };
  }
}

export async function listTodayRedeemedCoupons(
  tenantId: string,
): Promise<RewardCoupon[]> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return [];
    const since = startOfTodayIstanbul();
    const { data, error } = await supabase
      .from("reward_coupons")
      .select("coupon_code, table_id, reward_text, redeemed_at, status, created_at")
      .eq("tenant_id", tenantId)
      .or("status.eq.REDEEMED,status.eq.redeemed")
      .order("redeemed_at", { ascending: false, nullsFirst: false })
      .limit(20);
    if (error || !Array.isArray(data)) return [];
    const sinceMs = Date.parse(since);
    return (data as CouponRow[])
      .map(mapCoupon)
      .filter((coupon) => {
        if (!coupon.redeemedAt) return true;
        const at = Date.parse(coupon.redeemedAt);
        return Number.isFinite(at) && at >= sinceMs;
      })
      .slice(0, 8);
  } catch {
    return [];
  }
}

export async function fetchCouponMetrics(
  tenantId: string,
): Promise<CouponMetrics> {
  const empty: CouponMetrics = {
    issuedCount: 0,
    redeemedCount: 0,
    avgDwellMinutes: null,
  };
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return empty;
    const { data, error } = await supabase
      .from("reward_coupons")
      .select("status, redeemed_at")
      .eq("tenant_id", tenantId);
    if (error || !Array.isArray(data)) return empty;

    const rows = data as CouponRow[];
    const redeemed = rows.filter((row) => isRedeemed(row.status));
    return {
      issuedCount: rows.length,
      redeemedCount: redeemed.length,
      avgDwellMinutes: null,
    };
  } catch {
    return empty;
  }
}

export function formatRedeemedClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
