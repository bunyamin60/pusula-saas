import { tenantConfig, type CampaignProduct, type CompassQuestion, type Recipe } from "@/config/tenant.config";
import {
  getCampaignSettings,
  matchTagsOf,
  optionTagOf,
} from "@/lib/campaignState";

const NEUTRAL_VISUAL = {
  liquid: "color-mix(in srgb, var(--primary) 55%, var(--surface))",
  foam: "color-mix(in srgb, var(--on-surface) 12%, var(--surface))",
  iced: false,
};

export function productToRecipe(product: CampaignProduct): Recipe {
  const fallback = tenantConfig.compass.recipes.find(
    (recipe) => recipe.id === product.id,
  );
  const tags = matchTagsOf(product);
  const iced = tags.some((tag) => /soğuk|iced|buz|ice/i.test(tag));
  const visual = fallback
    ? { ...fallback.visual, iced: iced || fallback.visual.iced }
    : { ...NEUTRAL_VISUAL, iced };

  return {
    id: product.id,
    name: product.name,
    originNote: product.tagline || product.description || "",
    notes: (product.tastingNotes ?? []).map((note) => note.trim()).filter(Boolean),
    profile: fallback?.profile ?? {},
    visual,
    imageUrl: product.imageUrl,
    tags,
    tagline: product.tagline,
    tastingNotes: product.tastingNotes,
    accentColor: product.accentColor,
  };
}

export function recipesFromCampaign(campaign = getCampaignSettings()): Recipe[] {
  if (campaign.products.length > 0) {
    return campaign.products.map(productToRecipe);
  }
  return tenantConfig.compass.recipes.map((recipe) => ({ ...recipe }));
}

export function userChoicesFromAnswers(
  answers: Record<string, string>,
  questions: CompassQuestion[],
): string[] {
  return questions
    .map((question) => {
      const stored = answers[question.id]?.trim() ?? "";
      if (!stored) return "";
      const option = question.options.find(
        (item) => item.id === stored || optionTagOf(item) === stored,
      );
      return option ? optionTagOf(option) : stored;
    })
    .filter(Boolean);
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function bestProductMatch(
  products: CampaignProduct[],
  userChoices: string[],
): CampaignProduct {
  const scored = products.map((product) => ({
    product,
    score: matchTagsOf(product).filter((tag) => userChoices.includes(tag)).length,
  }));
  const bestScore = Math.max(0, ...scored.map((item) => item.score));
  const pool =
    bestScore === 0
      ? products
      : scored.filter((item) => item.score === bestScore).map((item) => item.product);
  return pickRandom(pool.length > 0 ? pool : products);
}

export function matchRecipe(
  answers: Record<string, string>,
  campaign = getCampaignSettings(),
): Recipe {
  const userChoices = userChoicesFromAnswers(answers, campaign.questions);

  if (campaign.products.length > 0) {
    return productToRecipe(bestProductMatch(campaign.products, userChoices));
  }

  const recipes = recipesFromCampaign(campaign);
  const { rules, fallbackRecipeId } = tenantConfig.compass;
  const matched = rules.find((rule) =>
    Object.entries(rule.when).every(([key, value]) => answers[key] === value),
  );
  const recipeId = matched?.recipeId ?? fallbackRecipeId;
  return recipes.find((recipe) => recipe.id === recipeId) ?? recipes[0];
}

export function getRecipeById(
  id: string | null,
  campaign = getCampaignSettings(),
): Recipe | null {
  if (!id) return null;
  return recipesFromCampaign(campaign).find((recipe) => recipe.id === id) ?? null;
}
