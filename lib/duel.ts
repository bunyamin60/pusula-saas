import { useEffect, useState } from "react";
import {
  tenantConfig,
  type DuelGameId,
  type EnabledGames,
} from "@/config/tenant.config";

export type DuelPlayerStatus = "idle" | "in_game";

export type DuelPlayer = {
  clientId: string;
  nickname: string;
  avatar: string;
  games: DuelGameId[];
  status: DuelPlayerStatus;
  onlineAt: string;
};

export type DuelMatch = {
  id: string;
  gameId: DuelGameId;
  opponent: DuelPlayer;
};

export type DuelIdentity = {
  nickname: string;
  avatar: string;
};

export type SelectedGame = DuelGameId | "random";

export const DUEL_GAME_IDS: DuelGameId[] = [
  "trivia",
  "emoji",
  "swipe",
  "number",
  "quiz",
];

export const CHALLENGE_TIMEOUT_MS = 15_000;

export type ChallengeRequestPayload = {
  matchId: string;
  gameId: DuelGameId;
  targetId: string;
  from: DuelPlayer;
};

export type ChallengeAcceptPayload = {
  matchId: string;
  targetId: string;
  by: DuelPlayer;
};

export type ChallengeDeclinePayload = {
  matchId: string;
  targetId: string;
  reason: "declined" | "timeout";
};

export type ChallengeCancelPayload = {
  challengerId: string;
  targetId: string;
};

export function enabledGameIds(enabled: EnabledGames): DuelGameId[] {
  return DUEL_GAME_IDS.filter((id) => enabled[id]);
}

export function makeDuelClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const CLIENT_ID_STORAGE_KEY = "duel_client_id";
const IDENTITY_STORAGE_KEY = "duel_identity";
const MATCH_STORAGE_KEY = "duel_active_match";

/**
 * Reuses the same clientId across a page refresh (sessionStorage is scoped to
 * the tab and cleared on real tab close), so a reloading player keeps their
 * identity and can rejoin an in-progress match room.
 */
export function readOrCreateClientId(): string {
  if (typeof window !== "undefined") {
    try {
      const existing = window.sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
      if (existing) return existing;
    } catch {
      // ignore storage errors, fall through to a fresh id
    }
  }
  const created = makeDuelClientId();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
    } catch {
      // ignore storage errors
    }
  }
  return created;
}

export function persistIdentity(identity: DuelIdentity): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // ignore storage errors
  }
}

export function readOrCreateIdentity(): DuelIdentity {
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(IDENTITY_STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as DuelIdentity;
        const allowed = tenantConfig.duel.nicknames.aliases.some(
          (alias) =>
            alias.nickname === stored.nickname && alias.avatar === stored.avatar,
        );
        if (allowed) return stored;
      }
    } catch {
      // ignore storage errors, fall through to a fresh identity
    }
  }
  const created = generateIdentity();
  persistIdentity(created);
  return created;
}

/** Persists the active match so a page refresh can attempt to rejoin the same room. */
export function persistActiveMatch(match: DuelMatch): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(match));
  } catch {
    // ignore storage errors
  }
}

export function readPersistedMatch(): DuelMatch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MATCH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DuelMatch) : null;
  } catch {
    return null;
  }
}

export function clearPersistedMatch(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(MATCH_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function generateIdentity(): DuelIdentity {
  const { aliases } = tenantConfig.duel.nicknames;
  const selected = aliases[Math.floor(Math.random() * aliases.length)];
  return { nickname: selected.nickname, avatar: selected.avatar };
}

export function commonGames(
  ownGames: DuelGameId[],
  opponentGames: DuelGameId[],
): DuelGameId[] {
  return ownGames.filter((id) => opponentGames.includes(id));
}

export function pickRandomGame(ids: DuelGameId[]): DuelGameId | null {
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

export function resolveGameForMatch(
  selected: SelectedGame,
  ownGames: DuelGameId[],
  opponentGames: DuelGameId[],
): DuelGameId | null {
  if (
    selected !== "random" &&
    ownGames.includes(selected) &&
    opponentGames.includes(selected)
  ) {
    return selected;
  }
  return pickRandomGame(commonGames(ownGames, opponentGames));
}

export function makeMatchId(tenantId: string): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${tenantId}-${Date.now().toString(36)}-${random}`;
}

export function deterministicNumber(seed: string, max: number): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % max) + 1;
}

/** Shared render-safe clock: starts at 0 and is corrected via effect to avoid impure renders. */
export function useDuelClock(interval = 100): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}
