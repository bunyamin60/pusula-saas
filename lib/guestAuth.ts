import { writeCustomerProfile, type CustomerProfile } from "@/lib/customerProfile";
import { getSupabase } from "@/lib/supabase";
import {
  readStampCard,
  writeStampCard,
  type StampCardState,
} from "@/lib/stampCard";

export type GuestAuthInput = {
  tenantId: string;
  clientId: string;
  nickname: string;
  pin: string;
};

export type GuestAuthResult =
  | { ok: true; profile: CustomerProfile; stamps: StampCardState }
  | { ok: false; reason: "bad_pin" | "invalid" | "offline" | "taken" };

type CustomerRow = {
  tenant_id: string;
  client_id: string;
  nickname: string | null;
  pin_code: string | null;
  stamp_count: number | null;
  last_coupon_code: string | null;
};

const NICKNAME_MAX = 15;
const CUSTOMER_COLS =
  "tenant_id, client_id, nickname, pin_code, stamp_count, last_coupon_code";

export function normalizeNickname(raw: string): string {
  return raw.trim().slice(0, NICKNAME_MAX);
}

export function normalizePin(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

function clampStamp(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.floor(n)));
}

function nickKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("tr-TR");
}

function mergeStamps(
  tenantId: string,
  clientId: string,
  remote: CustomerRow | null,
): StampCardState {
  const local = readStampCard(tenantId, clientId);
  const remoteCount = clampStamp(remote?.stamp_count);
  const remoteCode =
    typeof remote?.last_coupon_code === "string" && remote.last_coupon_code.trim()
      ? remote.last_coupon_code.trim()
      : null;
  return writeStampCard(tenantId, clientId, {
    count: Math.max(local.count, remoteCount),
    lastCode: local.lastCode || remoteCode,
  });
}

function sealSession(
  tenantId: string,
  clientId: string,
  nickname: string,
  stamps: StampCardState,
): GuestAuthResult {
  writeStampCard(tenantId, clientId, stamps);
  return {
    ok: true,
    profile: writeCustomerProfile({ name: nickname }),
    stamps,
  };
}

async function findByNickname(
  tenantId: string,
  nickname: string,
): Promise<{ row: CustomerRow | null; error: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { row: null, error: true };
  const safe = nickname.replace(/[%_]/g, "");
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLS)
    .eq("tenant_id", tenantId)
    .ilike("nickname", safe)
    .limit(5);
  if (error) return { row: null, error: true };
  const rows = (data ?? []) as CustomerRow[];
  const row =
    rows.find((entry) => nickKey(entry.nickname) === nickKey(nickname)) ?? null;
  return { row, error: false };
}

async function findByClientId(
  tenantId: string,
  clientId: string,
): Promise<{ row: CustomerRow | null; error: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { row: null, error: true };
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLS)
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) return { row: null, error: true };
  return { row: (data as CustomerRow | null) ?? null, error: false };
}

/** Free current client_id slot so another row can claim it (no DELETE grant). */
async function parkClientRow(
  tenantId: string,
  clientId: string,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("customers")
    .update({
      client_id: `parked_${clientId}_${Date.now()}`,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId);
  return !error;
}

async function loginExisting(
  row: CustomerRow,
  input: GuestAuthInput,
  nickname: string,
  pin: string,
): Promise<GuestAuthResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: "offline" };
  if ((row.pin_code ?? "").trim() !== pin) {
    return { ok: false, reason: "bad_pin" };
  }

  const stamps = mergeStamps(input.tenantId, input.clientId, row);

  if (row.client_id !== input.clientId) {
    const device = await findByClientId(input.tenantId, input.clientId);
    if (device.error) return { ok: false, reason: "offline" };
    if (device.row && nickKey(device.row.nickname) !== nickKey(nickname)) {
      const parked = await parkClientRow(input.tenantId, input.clientId);
      if (!parked) return { ok: false, reason: "offline" };
    }
  }

  const { error } = await supabase
    .from("customers")
    .update({
      client_id: input.clientId,
      nickname,
      pin_code: pin,
      stamp_count: stamps.count,
      last_coupon_code: stamps.lastCode,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("client_id", row.client_id);

  // If client_id already moved (same device), match by nickname instead.
  if (error) {
    const { error: byNickError } = await supabase
      .from("customers")
      .update({
        client_id: input.clientId,
        nickname,
        pin_code: pin,
        stamp_count: stamps.count,
        last_coupon_code: stamps.lastCode,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", input.tenantId)
      .eq("nickname", row.nickname);
    if (byNickError) return { ok: false, reason: "offline" };
  }

  return sealSession(input.tenantId, input.clientId, nickname, stamps);
}

/**
 * Nickname + PIN guest sign-in against `customers`.
 * Live schema uses (tenant_id, client_id) — no `id` column.
 */
export async function signInWithNicknamePin(
  input: GuestAuthInput,
): Promise<GuestAuthResult> {
  const nickname = normalizeNickname(input.nickname);
  const pin = normalizePin(input.pin);
  if (!input.tenantId || !input.clientId || !nickname || !isValidPin(pin)) {
    return { ok: false, reason: "invalid" };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: "offline" };

  const local = readStampCard(input.tenantId, input.clientId);

  try {
    const byNick = await findByNickname(input.tenantId, nickname);
    if (byNick.error) return { ok: false, reason: "offline" };
    if (byNick.row) {
      return loginExisting(byNick.row, input, nickname, pin);
    }

    const byClient = await findByClientId(input.tenantId, input.clientId);
    if (byClient.error) return { ok: false, reason: "offline" };

    if (byClient.row) {
      const stamps = mergeStamps(input.tenantId, input.clientId, byClient.row);
      const { error } = await supabase
        .from("customers")
        .update({
          nickname,
          pin_code: pin,
          stamp_count: stamps.count,
          last_coupon_code: stamps.lastCode,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", input.tenantId)
        .eq("client_id", input.clientId);

      if (error) {
        if (error.code === "23505") {
          const again = await findByNickname(input.tenantId, nickname);
          if (again.row) return loginExisting(again.row, input, nickname, pin);
          return { ok: false, reason: "taken" };
        }
        return { ok: false, reason: "offline" };
      }

      return sealSession(input.tenantId, input.clientId, nickname, stamps);
    }

    const stamps = writeStampCard(input.tenantId, input.clientId, local);
    const { error: insertError } = await supabase.from("customers").insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      nickname,
      pin_code: pin,
      stamp_count: stamps.count,
      last_coupon_code: stamps.lastCode,
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const again = await findByNickname(input.tenantId, nickname);
        if (again.row) return loginExisting(again.row, input, nickname, pin);
        const device = await findByClientId(input.tenantId, input.clientId);
        if (device.row) {
          const merged = mergeStamps(input.tenantId, input.clientId, device.row);
          const { error: patchError } = await supabase
            .from("customers")
            .update({
              nickname,
              pin_code: pin,
              stamp_count: merged.count,
              last_coupon_code: merged.lastCode,
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", input.tenantId)
            .eq("client_id", input.clientId);
          if (!patchError) {
            return sealSession(input.tenantId, input.clientId, nickname, merged);
          }
          return { ok: false, reason: "taken" };
        }
        return { ok: false, reason: "taken" };
      }
      return { ok: false, reason: "offline" };
    }

    return sealSession(input.tenantId, input.clientId, nickname, stamps);
  } catch {
    return { ok: false, reason: "offline" };
  }
}
