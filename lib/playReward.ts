import {
  tenantConfig,
  type PlayRewardProgress,
  type Recipe,
} from "@/config/tenant.config";
import { getActiveTenantId, getCampaignSettings } from "@/lib/campaignState";
import { getRecipeById } from "@/lib/matchRecipe";
import { registerRewardCoupon } from "@/lib/rewardCoupons";

const EMPTY: PlayRewardProgress = {
  elapsedSeconds: 0,
  isUnlocked: false,
  claimedCode: null,
  lastPing: 0,
  recipeId: null,
};

type Listener = () => void;

const listeners = new Set<Listener>();
let memory: PlayRewardProgress | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function playRewardStorageKey(): string {
  return tenantConfig.playReward.storageKey;
}

export function playRewardTargetSeconds(): number {
  try {
    const minutes = getCampaignSettings().durationMinutes;
    if (Number.isInteger(minutes) && minutes >= 10 && minutes <= 45) {
      return minutes * 60;
    }
  } catch {
    // Campaign store may not be bound during the first SSR pass.
  }
  return tenantConfig.playReward.targetSeconds;
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
  const elapsed = Math.max(a.elapsedSeconds, b.elapsedSeconds);
  const unlocked =
    a.isUnlocked || b.isUnlocked || elapsed >= target || Boolean(claimed);
  return {
    elapsedSeconds: unlocked ? Math.max(elapsed, target) : elapsed,
    isUnlocked: unlocked,
    claimedCode: claimed,
    lastPing: Math.max(a.lastPing, b.lastPing),
    recipeId,
  };
}

function sameProgress(a: PlayRewardProgress, b: PlayRewardProgress): boolean {
  return (
    a.elapsedSeconds === b.elapsedSeconds &&
    a.isUnlocked === b.isUnlocked &&
    a.claimedCode === b.claimedCode &&
    a.lastPing === b.lastPing &&
    (a.recipeId ?? null) === (b.recipeId ?? null)
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

export function clearPlayRewardProgress(): void {
  memory = { ...EMPTY };
  if (canUseStorage()) {
    localStorage.removeItem(playRewardStorageKey());
  }
  emit();
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
  const unlocked = Boolean(raw?.isUnlocked) || elapsed >= target || Boolean(claimed);
  return {
    elapsedSeconds: unlocked ? Math.max(elapsed, target) : Math.floor(elapsed),
    isUnlocked: unlocked,
    claimedCode: claimed,
    lastPing: typeof raw?.lastPing === "number" && raw.lastPing > 0 ? raw.lastPing : 0,
    recipeId,
  };
}

function readStored(): PlayRewardProgress {
  if (!canUseStorage()) return { ...EMPTY };
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

export function sealPlayRewardClaim(code: string, recipeId: string): PlayRewardProgress {
  const current = getClientPlayReward();
  const target = playRewardTargetSeconds();
  const next = persist({
    ...current,
    elapsedSeconds: Math.max(current.elapsedSeconds, target),
    isUnlocked: true,
    claimedCode: current.claimedCode || code,
    recipeId:
      current.recipeId && current.recipeId !== "campaign"
        ? current.recipeId
        : recipeId,
    lastPing: Date.now(),
  });
  const sealed = next.claimedCode || code;
  const recipe = getPlayRewardRecipe(next.recipeId);
  const rewardText =
    recipe?.name?.trim() || getCampaignSettings().hook.trim() || "";
  void registerRewardCoupon({
    tenantId: getActiveTenantId(),
    code: sealed,
    tableId: tenantConfig.brand.tableName,
    rewardText,
  });
  return next;
}

export function applyPlayRewardTick(
  now = Date.now(),
  visible = typeof document !== "undefined" && document.visibilityState === "visible",
): PlayRewardProgress {
  persist(getClientPlayReward());
  const current = getClientPlayReward();
  const targetSeconds = playRewardTargetSeconds();
  const { maxCreditSeconds } = tenantConfig.playReward;

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
    lastPing: now,
  });
}
