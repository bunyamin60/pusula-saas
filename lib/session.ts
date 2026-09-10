import { campaignDurationMs, getCampaignSettings } from "@/lib/campaignState";
import {
  tenantConfig,
  type ExperienceId,
  type FlowStep,
  type TalkFlagVote,
} from "@/config/tenant.config";
import { DEFAULT_TENANT_ID, resolveTenantId } from "@/lib/tenant";

export interface RewardSession {
  code: string;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
  prizeId?: string;
  prizeLabel?: string;
  prizeCaption?: string;
  socialUnlocked?: boolean;
}

export interface PersistedSession {
  v: 2;
  tenantId: string;
  step: FlowStep;
  answers: Record<string, string>;
  questionIndex: number;
  recipeId: string | null;
  reward: RewardSession | null;
  experience?: ExperienceId;
  talkCategoryId?: string | null;
  talkIndex?: number;
  talkSurpriseSeen?: boolean;
  talkAnswers?: Record<string, string>;
  talkVotes?: Record<string, TalkFlagVote>;
}

const SESSION_VERSION = 2 as const;
const LEGACY_DEFAULT_KEYS = [
  "wl-session:2:arada-cadde-54",
  "wl-session:arada-cadde-54",
];

let boundTenantId = DEFAULT_TENANT_ID;

function storageKey(tenantId = boundTenantId): string {
  return `wl-session:${SESSION_VERSION}:${tenantId}`;
}

function legacyStorageKey(tenantId = boundTenantId): string {
  return `wl-session:${tenantId}`;
}

export function bindSessionTenant(tenantId: string): void {
  const next = resolveTenantId(tenantId);
  if (next === boundTenantId) return;
  boundTenantId = next;
  memory = null;
}

export const EMPTY_SESSION: PersistedSession = {
  v: SESSION_VERSION,
  tenantId: DEFAULT_TENANT_ID,
  step: "landing",
  answers: {},
  questionIndex: 0,
  recipeId: null,
  reward: null,
  experience: undefined,
  talkCategoryId: null,
  talkIndex: 0,
  talkSurpriseSeen: false,
  talkAnswers: {},
  talkVotes: {},
};

type Listener = () => void;

const listeners = new Set<Listener>();
let memory: PersistedSession | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emptySession(): PersistedSession {
  return {
    ...EMPTY_SESSION,
    tenantId: boundTenantId,
    answers: {},
    talkAnswers: {},
    talkVotes: {},
  };
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isLockedReward(reward: RewardSession | null): boolean {
  return Boolean(reward && reward.usedAt == null && reward.socialUnlocked === false);
}

export function isActiveReward(
  reward: RewardSession | null,
  now = Date.now(),
): boolean {
  if (!reward || reward.usedAt != null) return false;
  if (reward.socialUnlocked === false) return true;
  return reward.expiresAt > now;
}

function discardStaleStorage() {
  if (!canUseStorage()) return;
  localStorage.removeItem(storageKey());
  localStorage.removeItem(legacyStorageKey());
  if (boundTenantId === DEFAULT_TENANT_ID) {
    LEGACY_DEFAULT_KEYS.forEach((key) => localStorage.removeItem(key));
  }
}

export function loadSession(): PersistedSession | null {
  if (!canUseStorage()) return null;

  try {
    const raw =
      localStorage.getItem(storageKey()) ??
      (boundTenantId === DEFAULT_TENANT_ID
        ? LEGACY_DEFAULT_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
        : null);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedSession;
    const sameTenant =
      parsed.tenantId === boundTenantId ||
      (boundTenantId === DEFAULT_TENANT_ID &&
        (parsed.tenantId === "arada-cadde-54" || parsed.tenantId === DEFAULT_TENANT_ID));
    if (parsed.v !== SESSION_VERSION || !sameTenant) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeLoadedSession(loaded: PersistedSession | null): PersistedSession {
  if (!loaded) return emptySession();

  const talkIndex = Number.isInteger(loaded.talkIndex)
    ? Math.max(0, loaded.talkIndex as number)
    : 0;
  const talkStep =
    loaded.step === "talk-play" && !loaded.talkCategoryId ? "talk-pick" : loaded.step;
  const restoredStep =
    loaded.step === "reward" || loaded.step === "game"
      ? loaded.experience === "talk"
        ? loaded.talkCategoryId
          ? "talk-play"
          : "talk-pick"
        : loaded.recipeId
          ? "match"
          : "landing"
      : talkStep === "reward"
        ? loaded.recipeId
          ? "match"
          : "landing"
        : talkStep;

  return {
    ...loaded,
    v: SESSION_VERSION,
    tenantId: boundTenantId,
    step: restoredStep,
    answers: { ...loaded.answers },
    experience: loaded.experience,
    talkCategoryId: loaded.talkCategoryId ?? null,
    talkIndex,
    talkSurpriseSeen: Boolean(loaded.talkSurpriseSeen),
    talkAnswers: parseStringMap(loaded.talkAnswers),
    talkVotes: parseVoteMap(loaded.talkVotes),
  };
}

function parseStringMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function parseVoteMap(raw: unknown): Record<string, TalkFlagVote> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, TalkFlagVote] =>
        entry[1] === "red" || entry[1] === "green",
    ),
  );
}

export function getClientSession(): PersistedSession {
  if (memory) return memory;

  if (canUseStorage()) {
    localStorage.removeItem(legacyStorageKey());
  }

  const loaded = loadSession();
  const sanitized = sanitizeLoadedSession(loaded);

  memory = sanitized;
  return memory;
}

export function getServerSession(): PersistedSession | null {
  return null;
}

function persist(next: PersistedSession) {
  memory = next;
  if (canUseStorage()) {
    if (next.step === "landing" && !next.reward) {
      discardStaleStorage();
    } else {
      localStorage.setItem(storageKey(), JSON.stringify(next));
    }
  }
  emit();
}

export function updateSession(
  patch: Partial<Omit<PersistedSession, "v" | "tenantId">>,
): void {
  const current = getClientSession();
  persist({
    ...current,
    ...patch,
    v: SESSION_VERSION,
    tenantId: boundTenantId,
  });
}

export function resetSession(): void {
  discardStaleStorage();
  persist(emptySession());
}

export function generateRewardCode(): string {
  const { codePrefix, codeDigits } = tenantConfig.reward;
  const max = 10 ** codeDigits;
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const n = bytes[0] % max;
  return `${codePrefix}${n.toString().padStart(codeDigits, "0")}`;
}

export function createReward(
  prize?: { id: string; label: string; caption: string },
  now = Date.now(),
): RewardSession {
  return {
    code: generateRewardCode(),
    createdAt: now,
    expiresAt: now + campaignDurationMs(getCampaignSettings()),
    usedAt: null,
    prizeId: prize?.id,
    prizeLabel: prize?.label,
    prizeCaption: prize?.caption,
    socialUnlocked: false,
  };
}

export function unlockReward(
  reward: RewardSession,
  now = Date.now(),
): RewardSession {
  if (reward.socialUnlocked !== false) return reward;
  return {
    ...reward,
    socialUnlocked: true,
    createdAt: now,
    expiresAt: now + campaignDurationMs(getCampaignSettings()),
  };
}

export function formatRewardCode(code: string): string {
  return tenantConfig.reward.displayHash ? `#${code}` : code;
}

export function resolveRestoredStep(session: PersistedSession): FlowStep {
  if (session.step === "game") {
    return session.experience === "talk" ? "talk-play" : "match";
  }
  if (session.step === "reward") {
    return session.recipeId ? "match" : "landing";
  }
  return session.step;
}

export function canRestartAfterReward(
  reward: RewardSession,
  now = Date.now(),
): boolean {
  return now >= reward.expiresAt;
}
