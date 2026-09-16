import { getSupabase } from "@/lib/supabase";
import {
  redeemClaimedReward,
  registerClaimedReward,
} from "@/lib/claimedRewards";

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

export async function registerRewardCoupon(input: {
  tenantId: string;
  code: string;
  tableId: string;
  rewardText: string;
}): Promise<void> {
  const code = normalizeCode(input.code);
  if (!input.tenantId || !code) return;

  try {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.from("reward_coupons").insert({
        tenant_id: input.tenantId,
        coupon_code: code,
        table_id: input.tableId.trim() || null,
        reward_text: input.rewardText.trim() || null,
        status: "ACTIVE",
      });
    }
  } catch {
    // Guest coupon still works locally if the kasa table is unreachable.
  }

  await registerClaimedReward(input);
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
    if (!row) {
      const legacy = await redeemClaimedReward(tenantId, code);
      if (legacy.ok) {
        return {
          ok: true,
          coupon: {
            code: legacy.reward.code,
            tableId: legacy.reward.tableId,
            rewardText: legacy.reward.rewardText,
            redeemedAt: new Date().toISOString(),
          },
        };
      }
      if (legacy.reason === "used") return { ok: false, reason: "used" };
      return { ok: false, reason: "missing" };
    }

    if (isRedeemed(row.status)) {
      return {
        ok: false,
        reason: "used",
        redeemedAt: row.redeemed_at ?? null,
      };
    }

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
    return {
      ok: true,
      coupon: mapCoupon((updated.data as CouponRow | null) ?? {
        ...row,
        status: "REDEEMED",
        redeemed_at: redeemedAt,
      }),
    };
  } catch {
    // Fall through to the previous coupon table.
  }

  const legacy = await redeemClaimedReward(tenantId, code);
  if (legacy.ok) {
    return {
      ok: true,
      coupon: {
        code: legacy.reward.code,
        tableId: legacy.reward.tableId,
        rewardText: legacy.reward.rewardText,
        redeemedAt: new Date().toISOString(),
      },
    };
  }
  return { ok: false, reason: legacy.reason };
}

export async function listTodayRedeemedCoupons(
  tenantId: string,
): Promise<RewardCoupon[]> {
  try {
    const supabase = getSupabase();
    if (!supabase || !tenantId) return [];
    const { data, error } = await supabase
      .from("reward_coupons")
      .select("coupon_code, table_id, reward_text, redeemed_at, status")
      .eq("tenant_id", tenantId)
      .in("status", ["REDEEMED", "redeemed"])
      .gte("redeemed_at", startOfTodayIstanbul())
      .order("redeemed_at", { ascending: false })
      .limit(5);
    if (error || !Array.isArray(data)) return [];
    return (data as CouponRow[]).map(mapCoupon);
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
