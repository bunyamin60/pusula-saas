import { tenantConfig } from "@/config/tenant.config";

export type DuelQuizQuestion = {
  prompt: string;
  options: readonly string[];
  answer: number;
};

// Legacy realtime duel questions are entertainment-only and never submitted
// to the trusted Quiz leaderboard or weekly overall league.
export function getAllDuelQuizQuestions(): readonly DuelQuizQuestion[] {
  return tenantConfig.duel.trivia;
}
