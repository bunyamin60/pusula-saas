import {
  tenantConfig,
  type PlayRewardProgress,
  type Recipe,
} from "@/config/tenant.config";
import {
  clampRewardDuration,
  getCampaignSettings,
} from "@/lib/campaignState";
import { getRecipeById } from "@/lib/matchRecipe";

const EMPTY: PlayRewardProgress = {
  elapsedSeconds: 0,
  isUnlocked: false,
  claimedCode: null,
  lastPing: 0,
  recipeId: null,
  redeemedAt: null,
};

type Listener = () => void;

const listeners = new Set<Listener>();
const RESET_FLAG = "arada_reward_reset";
let memory: PlayRewardProgress | null = null;
let serverAccrualAllowed = false;

function rewardResetPending(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof sessionStorage !== "undefined" &&
    sessionStorage.getItem(RESET_FLAG) === "1"
  );
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function playRewardStorageKey(): string {
  return tenantConfig.playReward.storageKey;
}

export function playRewardTargetSeconds(): number {
  try {
    const minutes = clampRewardDuration(getCampaignSettings().durationMinutes);
    return minutes * 60;
  } catch {
    // Campaign store may not be bound during the first SSR pass.
  }
  return tenantConfig.playReward.targetSeconds;
}

export function playRewardTargetMinutes(): number {
  return Math.max(1, Math.round(playRewardTargetSeconds() / 60));
}

function emit() {
  listeners.forEach((listener) => listener());
}

function mergeProgress(
  a: PlayRewardProgress,
  b: PlayRewardProgress,
): PlayRewardProgress {
  const target = playRewardTargetSeconds();
  const claimed = a.claimedCode || b.claimedCode;
  const recipeId = a.recipeId || b.recipeId;
  const redeemedAt = a.redeemedAt || b.redeemedAt || null;
  const elapsed = Math.max(a.elapsedSeconds, b.elapsedSeconds);
  const unlocked =
    a.isUnlocked || b.isUnlocked || elapsed >= target || Boolean(claimed);
  return {
    elapsedSeconds: unlocked ? Math.max(elapsed, target) : elapsed,
    isUnlocked: unlocked,
    claimedCode: claimed,
    lastPing: Math.max(a.lastPing, b.lastPing),
    recipeId,
    redeemedAt,
  };
}

function sameProgress(a: PlayRewardProgress, b: PlayRewardProgress): boolean {
  return (
    a.elapsedSeconds === b.elapsedSeconds &&
    a.isUnlocked === b.isUnlocked &&
    a.claimedCode === b.claimedCode &&
    a.lastPing === b.lastPing &&
    (a.recipeId ?? null) === (b.recipeId ?? null) &&
    (a.redeemedAt ?? null) === (b.redeemedAt ?? null)
  );
}

export function subscribePlayReward(listener: Listener): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined" && listeners.size === 1) {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined" && listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function onStorage(event: StorageEvent) {
  if (event.key !== playRewardStorageKey()) return;
  const stored = readStored();
  if (memory && sameProgress(memory, stored)) return;
  memory = stored;
  emit();
}

export function getServerPlayReward(): PlayRewardProgress {
  return EMPTY;
}

export function getClientPlayReward(): PlayRewardProgress {
  if (!memory) memory = readStored();
  return memory;
}

export function isPlayRewardAccrualAllowed(): boolean {
  return serverAccrualAllowed;
}

export function clearPlayRewardProgress(): void {
  memory = { ...EMPTY };
  serverAccrualAllowed = false;
  if (canUseStorage()) {
    localStorage.removeItem(playRewardStorageKey());
  }
  emit();
}

/** Drop the ikram bar back to zero and ignore a stale server snapshot until reload. */
export function markPlayRewardReset(): void {
  clearPlayRewardProgress();
  try {
    sessionStorage.setItem(RESET_FLAG, "1");
  } catch {
    // Session storage can be blocked; the server row is still cleared.
  }
}

let playSessions = 0;
const playSessionListeners = new Set<Listener>();

export function subscribePlaySession(listener: Listener): () => void {
  playSessionListeners.add(listener);
  return () => {
    playSessionListeners.delete(listener);
  };
}

export function isPlaySessionActive(): boolean {
  return playSessions > 0;
}

function emitPlaySession() {
  playSessionListeners.forEach((listener) => listener());
}

export function beginPlaySession(): void {
  playSessions += 1;
  emitPlaySession();
}

export function endPlaySession(): void {
  playSessions = Math.max(0, playSessions - 1);
  emitPlaySession();
}

export function completePlayRewardNow(): PlayRewardProgress {
  const current = getClientPlayReward();
  const target = playRewardTargetSeconds();
  return persist({
    ...current,
    elapsedSeconds: Math.max(current.elapsedSeconds, target),
    isUnlocked: true,
    lastPing: Date.now(),
  });
}

function persist(next: PlayRewardProgress): PlayRewardProgress {
  const merged = mergeProgress(next, readStored());
  if (memory && sameProgress(memory, merged)) return memory;
  memory = merged;
  if (canUseStorage()) {
    localStorage.setItem(playRewardStorageKey(), JSON.stringify(merged));
  }
  emit();
  return merged;
}

function clampProgress(raw: Partial<PlayRewardProgress> | null): PlayRewardProgress {
  const target = playRewardTargetSeconds();
  const elapsed = Math.max(
    0,
    Math.min(target, Number(raw?.elapsedSeconds) || 0),
  );
  const claimed =
    typeof raw?.claimedCode === "string" && raw.claimedCode.trim()
      ? raw.claimedCode
      : null;
  const recipeId =
    typeof raw?.recipeId === "string" && raw.recipeId.trim()
      ? raw.recipeId
      : null;
  const redeemedAt =
    typeof raw?.redeemedAt === "string" && raw.redeemedAt.trim()
      ? raw.redeemedAt
      : null;
  const unlocked = Boolean(raw?.isUnlocked) || elapsed >= target || Boolean(claimed);
  return {
    elapsedSeconds: unlocked ? Math.max(elapsed, target) : Math.floor(elapsed),
    isUnlocked: unlocked,
    claimedCode: claimed,
    lastPing: typeof raw?.lastPing === "number" && raw.lastPing > 0 ? raw.lastPing : 0,
    recipeId,
    redeemedAt,
  };
}

function readStored(): PlayRewardProgress {
  if (!canUseStorage()) return { ...EMPTY };
  if (rewardResetPending()) {
    localStorage.removeItem(playRewardStorageKey());
    return { ...EMPTY };
  }
  try {
    const raw = localStorage.getItem(playRewardStorageKey());
    if (!raw) return { ...EMPTY };
    return clampProgress(JSON.parse(raw) as Partial<PlayRewardProgress>);
  } catch {
    return { ...EMPTY };
  }
}

export function formatPlayClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function makePlayRewardCode(): string {
  const { codePrefix, codeLength, codeAlphabet } = tenantConfig.playReward;
  const bytes = new Uint32Array(codeLength);
  crypto.getRandomValues(bytes);
  let body = "";
  for (let i = 0; i < codeLength; i += 1) {
    body += codeAlphabet[bytes[i] % codeAlphabet.length];
  }
  return `${codePrefix}${body}`;
}

export function getPlayRewardRecipe(id: string | null | undefined): Recipe | null {
  if (!id) return null;
  return (
    getRecipeById(id) ??
    tenantConfig.playReward.recipes.find((recipe) => recipe.id === id) ??
    null
  );
}

export function matchPlayRewardRecipe(answers: Record<string, string>): Recipe {
  const { recipes, rules, fallbackRecipeId } = tenantConfig.playReward;
  const exact = rules.find((rule) =>
    Object.entries(rule.when).every(([key, value]) => answers[key] === value),
  );
  if (exact) {
    return recipes.find((recipe) => recipe.id === exact.recipeId) ?? recipes[0];
  }

  let best = recipes.find((recipe) => recipe.id === fallbackRecipeId) ?? recipes[0];
  let bestScore = -1;
  for (const recipe of recipes) {
    const score = Object.entries(recipe.profile).filter(
      ([key, value]) => answers[key] === value,
    ).length;
    if (score > bestScore) {
      best = recipe;
      bestScore = score;
    }
  }
  return best;
}

export function sealPlayRewardClaim(_code: string, recipeId: string): PlayRewardProgress {
  const current = getClientPlayReward();
  return persist({
    ...current,
    claimedCode: current.claimedCode,
    recipeId: recipeId.trim() || current.recipeId,
    lastPing: Date.now(),
  });
}

/** Server elapsed and coupon merge into the local cache without rewinding the clock. */
export function applyServerPlayProgress(input: {
  elapsedSeconds: number;
  targetSeconds: number;
  claimedCode: string | null;
  accrualAllowed: boolean;
}): PlayRewardProgress {
  const clientTarget = playRewardTargetSeconds();
  const current = getClientPlayReward();
  const serverElapsed = Math.max(0, Math.floor(input.elapsedSeconds) || 0);
  const claimed = input.claimedCode?.trim() || current.claimedCode || null;
  serverAccrualAllowed = input.accrualAllowed;
  if (rewardResetPending() && (claimed || serverElapsed > 0)) {
    return current;
  }
  if (rewardResetPending()) {
    try {
      sessionStorage.removeItem(RESET_FLAG);
    } catch {
      // Ignore a blocked session storage clear.
    }
  }
  const elapsed = claimed
    ? clientTarget
    : Math.min(clientTarget, serverElapsed);
  const next: PlayRewardProgress = {
    elapsedSeconds: elapsed,
    isUnlocked:
      Boolean(claimed) ||
      (input.accrualAllowed && elapsed >= Math.max(1, clientTarget - 1)),
    claimedCode: claimed,
    lastPing: current.lastPing,
    recipeId: memory?.recipeId ?? readStored().recipeId,
    redeemedAt: memory?.redeemedAt ?? readStored().redeemedAt,
  };
  memory = next;
  if (canUseStorage()) {
    localStorage.setItem(playRewardStorageKey(), JSON.stringify(next));
  }
  emit();
  return next;
}

const revealListeners = new Set<() => void>();

export function subscribePlayCouponReveal(listener: () => void): () => void {
  revealListeners.add(listener);
  return () => revealListeners.delete(listener);
}

function revealPlayCoupon(): void {
  revealListeners.forEach((listener) => listener());
}

async function postPlayHeartbeat(
  tenantId: string,
  playing: boolean,
): Promise<
  | (PlayRewardProgress & {
      accrualAllowed: boolean;
      reason: string | null;
    })
  | null
> {
  try {
    void tenantId;
    const previousCode = getClientPlayReward().claimedCode;
    const res = await fetch("/api/economy/play/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ playing }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      reason?: string;
      accrual_allowed?: boolean;
      elapsed_seconds?: number;
      target_seconds?: number;
      coupon_code?: string | null;
    };
    if (!res.ok || !data.ok) return null;
    const next = applyServerPlayProgress({
      elapsedSeconds: Number(data.elapsed_seconds) || 0,
      targetSeconds: Number(data.target_seconds) || playRewardTargetSeconds(),
      claimedCode: typeof data.coupon_code === "string" ? data.coupon_code : null,
      accrualAllowed: data.accrual_allowed === true,
    });
    if (next.claimedCode && next.claimedCode !== previousCode) revealPlayCoupon();
    return {
      ...next,
      accrualAllowed: data.accrual_allowed === true,
      reason: typeof data.reason === "string" ? data.reason : null,
    };
  } catch {
    return null;
  }
}

export async function syncPlayHeartbeat(
  tenantId: string,
  playing: boolean,
): ReturnType<typeof postPlayHeartbeat> {
  return postPlayHeartbeat(tenantId, playing);
}

export function markPlayRewardRedeemed(redeemedAt?: string | null): PlayRewardProgress {
  const current = getClientPlayReward();
  if (!current.claimedCode) return current;
  return persist({
    ...current,
    redeemedAt: redeemedAt || current.redeemedAt || new Date().toISOString(),
  });
}

export function applyPlayRewardTick(
  now = Date.now(),
  visible = typeof document !== "undefined" && document.visibilityState === "visible",
): PlayRewardProgress {
  persist(getClientPlayReward());
  const current = getClientPlayReward();
  const targetSeconds = playRewardTargetSeconds();
  const { maxCreditSeconds } = tenantConfig.playReward;

  if (!serverAccrualAllowed) {
    return persist({ ...current, lastPing: now });
  }

  if (current.isUnlocked && current.elapsedSeconds >= targetSeconds) {
    return current;
  }

  if (!visible) {
    return persist({ ...current, lastPing: now });
  }

  if (!current.lastPing) {
    return persist({ ...current, lastPing: now });
  }

  const deltaMs = now - current.lastPing;
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return persist({ ...current, lastPing: now });
  }

  const cappedMs = Math.min(deltaMs, maxCreditSeconds * 1000);
  const credit = Math.floor(cappedMs / 1000);
  if (credit <= 0) return current;

  const elapsed = Math.min(targetSeconds, current.elapsedSeconds + credit);
  return persist({
    ...current,
    elapsedSeconds: elapsed,
    isUnlocked: elapsed >= targetSeconds,
    lastPing: current.lastPing + credit * 1000,
  });
}
