import { NextResponse } from "next/server";
import { applyDeviceCookie, resolveDevice } from "@/lib/deviceCookie";
import {
  economyClient,
  readTenantId,
  verifyAdminPassword,
} from "@/lib/economyServer";

export async function POST(request: Request) {
  try {
    const device = await resolveDevice(request);
    const body = (await request.json()) as {
      tenantId?: string;
      code?: string;
      adminPassword?: string;
    };
    const tenantId = readTenantId(body, request);
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const adminPassword =
      typeof body.adminPassword === "string" ? body.adminPassword : "";
    if (!code) {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 }),
        device.token,
        device.fresh,
      );
    }
    if (!(await verifyAdminPassword(tenantId, adminPassword))) {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 }),
        device.token,
        device.fresh,
      );
    }

    const supabase = economyClient();
    const { data, error } = await supabase
      .from("reward_coupons")
      .select("coupon_code, table_id, reward_text, status, redeemed_at")
      .eq("tenant_id", tenantId)
      .eq("coupon_code", code)
      .maybeSingle();
    if (error || !data) {
      return applyDeviceCookie(
        NextResponse.json({ ok: false, reason: "missing" }),
        device.token,
        device.fresh,
      );
    }
    const row = data as {
      coupon_code: string;
      table_id: string | null;
      reward_text: string | null;
      status: string | null;
      redeemed_at: string | null;
    };
    if ((row.status ?? "").toUpperCase() === "REDEEMED") {
      return applyDeviceCookie(
        NextResponse.json({
          ok: false,
          reason: "used",
          redeemedAt: row.redeemed_at,
        }),
        device.token,
        device.fresh,
      );
    }
    const redeemedAt = new Date().toISOString();
    const updated = await supabase
      .from("reward_coupons")
      .update({ status: "REDEEMED", redeemed_at: redeemedAt })
      .eq("tenant_id", tenantId)
      .eq("coupon_code", code)
      .select("coupon_code, table_id, reward_text, status, redeemed_at")
      .maybeSingle();
    const coupon = (updated.data ?? {
      ...row,
      status: "REDEEMED",
      redeemed_at: redeemedAt,
    }) as {
      coupon_code: string;
      table_id: string | null;
      reward_text: string | null;
      redeemed_at: string | null;
    };
    return applyDeviceCookie(
      NextResponse.json({
        ok: true,
        coupon: {
          code: coupon.coupon_code,
          tableId: coupon.table_id ?? "",
          rewardText: coupon.reward_text ?? "",
          redeemedAt: coupon.redeemed_at,
        },
      }),
      device.token,
      device.fresh,
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
