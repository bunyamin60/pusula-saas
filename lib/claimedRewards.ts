import { getSupabase } from "@/lib/supabase";

export type ClaimedReward = {
  code: string;
  tableId: string;
  rewardText: string;
};

export type RedeemResult =
  | { ok: true; reward: ClaimedReward }
  | { ok: false; reason: "used" | "missing" | "offline" };

type RedeemRow = {
  code: string;
  table_id: string | null;
  reward_text: string | null;
  status: string;
  outcome: string;
};

export async function registerClaimedReward(input: {
  tenantId: string;
  code: string;
  tableId: string;
  rewardText: string;
}): Promise<void> {
  try {
    const supabase = getSupabase();
    const code = input.code.trim().toUpperCase();
    if (!supabase || !input.tenantId || !code) return;
    await supabase.rpc("register_claimed_reward", {
      p_tenant_id: input.tenantId,
      p_code: code,
      p_table_id: input.tableId.trim() || null,
      p_reward_text: input.rewardText.trim() || null,
    });
  } catch {
    // Guest coupon still works locally if the kasa table is unreachable.
  }
}

export async function redeemClaimedReward(
  tenantId: string,
  rawCode: string,
): Promise<RedeemResult> {
  try {
    const supabase = getSupabase();
    const code = rawCode.trim().toUpperCase().replace(/\s+/g, "");
    if (!supabase || !tenantId || !code) return { ok: false, reason: "offline" };
    const { data, error } = await supabase.rpc("redeem_claimed_reward", {
      p_tenant_id: tenantId,
      p_code: code,
    });
    if (error || !Array.isArray(data) || data.length === 0) {
      return { ok: false, reason: error ? "offline" : "missing" };
    }
    const row = data[0] as RedeemRow;
    if (row.outcome === "missing") return { ok: false, reason: "missing" };
    if (row.outcome === "used") return { ok: false, reason: "used" };
    return {
      ok: true,
      reward: {
        code: row.code,
        tableId: row.table_id?.trim() || "",
        rewardText: row.reward_text?.trim() || "",
      },
    };
  } catch {
    return { ok: false, reason: "offline" };
  }
}
