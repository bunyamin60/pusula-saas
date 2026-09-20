import { tenantConfig } from "@/config/tenant.config";

export type QuizQuestion = {
  prompt: string;
  options: readonly string[];
  answer: number;
};

export type QuizCategoryId = "cafe" | "turkey" | "general" | "sports";

export type QuizCategory = {
  id: QuizCategoryId;
  questions: readonly QuizQuestion[];
};

export function getQuizCategories(): readonly QuizCategory[] {
  return tenantConfig.duel.quizCategories as readonly QuizCategory[];
}

export function getQuizCategory(
  id: QuizCategoryId,
): QuizCategory | undefined {
  return getQuizCategories().find((category) => category.id === id);
}

export function getAllQuizQuestions(): QuizQuestion[] {
  return getQuizCategories().flatMap((category) => [...category.questions]);
}

export function quizCategoryTitle(id: QuizCategoryId): string {
  return tenantConfig.copy.duel.quizCategories[id];
}
