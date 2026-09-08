import {
  tenantConfig,
  type TenantCategory,
} from "@/config/tenant.config";
import { normalizeTenantCategory } from "@/lib/tenant";

export type LandingCopy = {
  kicker: string;
  greeting: string;
  accent: string;
  subhead: string;
};

const LEGACY_KICKERS = new Set([
  tenantConfig.copy.landing.kicker,
  "Cadde 54 Masalarına Özel Etkinlik",
]);

const STOCK_HERO_TITLES = new Set<string>(
  Object.values(tenantConfig.copy.landing.byCategory).map((pack) => pack.greeting),
);
const STOCK_HERO_SUBTITLES = new Set<string>(
  Object.values(tenantConfig.copy.landing.byCategory).map((pack) => pack.subhead),
);

export function resolveTenantCategory(category: unknown): TenantCategory {
  return normalizeTenantCategory(category) ?? "cafe";
}

export function experienceCategoryOf(
  category: TenantCategory | string | undefined,
): TenantCategory {
  return resolveTenantCategory(category);
}

export function isLoungeVenue(input: {
  tenantId?: string;
  category?: TenantCategory | string;
  themePreset?: unknown;
  bg?: string;
}): boolean {
  return resolveTenantCategory(input.category) === "lounge";
}

export function isCafeVenue(category?: TenantCategory | string): boolean {
  return resolveTenantCategory(category) === "cafe";
}

export function isFoodVenue(category?: TenantCategory | string): boolean {
  return resolveTenantCategory(category) === "food";
}

function categoryPack(category: TenantCategory) {
  const packs = tenantConfig.copy.landing.byCategory as Record<
    string,
    { greeting: string; greetingAccent: string; subhead: string }
  >;
  return packs[category] ?? packs.cafe ?? packs.coffee;
}

export function kickerFromBrand(brandName: string): string {
  const brand = brandName.trim();
  if (!brand) return "";
  return tenantConfig.copy.landing.kickerTemplate.replace("{brand}", brand);
}

function heroFallback(category: TenantCategory) {
  return categoryPack(category);
}

export function resolveLandingCopy(input: {
  brandName: string;
  category?: TenantCategory | string;
  themePreset?: unknown;
  landingKicker?: string;
  landingGreeting?: string;
  landingAccent?: string;
  landingSubhead?: string;
  heroTitle?: string;
  heroSubtitle?: string;
}): LandingCopy {
  const category = resolveTenantCategory(input.category);
  const pack = heroFallback(category);
  const storedKicker = input.landingKicker?.trim() ?? "";
  const storedTitle = (input.heroTitle || input.landingGreeting || "").trim();
  const storedSubtitle = (input.heroSubtitle || input.landingSubhead || "").trim();
  const storedAccent = input.landingAccent?.trim() ?? "";
  const generatedKicker = kickerFromBrand(input.brandName);
  const kickerLooksStock =
    !storedKicker ||
    LEGACY_KICKERS.has(storedKicker) ||
    storedKicker.endsWith("Masalarına Özel");

  const greeting =
    storedTitle && !STOCK_HERO_TITLES.has(storedTitle) ? storedTitle : pack.greeting;
  const subhead =
    storedSubtitle && !STOCK_HERO_SUBTITLES.has(storedSubtitle)
      ? storedSubtitle
      : pack.subhead;
  const accent =
    storedAccent && greeting.includes(storedAccent)
      ? storedAccent
      : greeting.includes(pack.greetingAccent)
        ? pack.greetingAccent
        : "";

  return {
    kicker: kickerLooksStock ? generatedKicker : storedKicker,
    greeting,
    accent,
    subhead,
  };
}

export function brandShortName(brandName: string): string {
  const trimmed = brandName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function splashMessage(brandName: string): string {
  const brand = brandName.trim();
  if (!brand) return tenantConfig.copy.splash.message;
  return tenantConfig.copy.splash.messageTemplate.replace("{brand}", brand);
}

export function compassTitleOf(category?: TenantCategory | string): string {
  const resolved = resolveTenantCategory(category);
  const titles = tenantConfig.copy.landing.compassTitleByCategory as Record<
    string,
    string
  >;
  return titles[resolved] ?? titles.cafe ?? titles.coffee;
}

export function matchAsideLine(
  brandName: string,
  category: TenantCategory | string,
): string {
  const brand = brandShortName(brandName);
  const resolved = resolveTenantCategory(category);
  const gifts = tenantConfig.copy.match.asideGift as Record<string, string>;
  const gift = gifts[resolved] ?? gifts.general;
  if (!brand) return tenantConfig.copy.match.aside;
  return tenantConfig.copy.match.asideTemplate
    .replace("{gift}", gift)
    .replace("{brand}", brand);
}
