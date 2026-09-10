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
  matchId: string;
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

export function generateIdentity(): DuelIdentity {
  const { adjectives, nouns, emojis } = tenantConfig.duel.nicknames;
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const avatar = emojis[Math.floor(Math.random() * emojis.length)];
  return { nickname: `${adjective} ${noun}`, avatar };
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
