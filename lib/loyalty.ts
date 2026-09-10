export type LoyaltyStatus = {
  hasReviewed: boolean;
  isRedeemed: boolean;
  redeemedAt: number | null;
  code: string | null;
};

const EMPTY: LoyaltyStatus = {
  hasReviewed: false,
  isRedeemed: false,
  redeemedAt: null,
  code: null,
};

export function loyaltyStorageKey(tenantId: string): string {
  return `pusula_status_${tenantId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function makePerkCode(tenantId: string): string {
  const prefix = tenantId.toUpperCase().slice(0, 4);
  const n = Math.floor(1000 + Math.random() * 9000);
  return `#${prefix}-${n}`;
}

export function loadLoyalty(tenantId: string): LoyaltyStatus {
  if (!canUseStorage()) return { ...EMPTY };
  try {
    const raw = localStorage.getItem(loyaltyStorageKey(tenantId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<LoyaltyStatus>;
    const isRedeemed = Boolean(parsed.isRedeemed);
    return {
      hasReviewed: Boolean(parsed.hasReviewed) || isRedeemed,
      isRedeemed,
      redeemedAt: typeof parsed.redeemedAt === "number" ? parsed.redeemedAt : null,
      code: typeof parsed.code === "string" && parsed.code.trim() ? parsed.code : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveLoyalty(tenantId: string, next: LoyaltyStatus): void {
  if (!canUseStorage()) return;
  localStorage.setItem(loyaltyStorageKey(tenantId), JSON.stringify(next));
}

export function markReviewed(tenantId: string): LoyaltyStatus {
  const current = loadLoyalty(tenantId);
  const next: LoyaltyStatus = {
    ...current,
    hasReviewed: true,
    code: current.code || makePerkCode(tenantId),
  };
  saveLoyalty(tenantId, next);
  return next;
}

export function markRedeemed(tenantId: string, code: string, now = Date.now()): LoyaltyStatus {
  const next: LoyaltyStatus = {
    hasReviewed: true,
    isRedeemed: true,
    redeemedAt: now,
    code,
  };
  saveLoyalty(tenantId, next);
  return next;
}

export function clearLoyalty(tenantId: string): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(loyaltyStorageKey(tenantId));
}
