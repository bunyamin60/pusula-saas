import { tenantConfig } from "@/config/tenant.config";

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: readonly string[];
};

export type QuizCategoryId = "cafe" | "turkey" | "general" | "sports";

export const QUIZ_CATEGORY_IDS = [
  "cafe",
  "turkey",
  "general",
  "sports",
] as const satisfies readonly QuizCategoryId[];

export function isQuizCategoryId(value: string): value is QuizCategoryId {
  return QUIZ_CATEGORY_IDS.includes(value as QuizCategoryId);
}

export function quizCategoryTitle(id: QuizCategoryId): string {
  return tenantConfig.copy.duel.quizCategories[id];
}
