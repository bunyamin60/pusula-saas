import {
  tenantConfig,
  type CampaignProduct,
  type CompassIcon,
  type CompassOption,
  type CompassQuestion,
  type DuelGameId,
  type EnabledGames,
  type TalkCategory,
  type TalkPrompt,
  type TenantCategory,
  type TenantThemeConfig,
  type ThemePresetId,
  type WheelPrize,
} from "@/config/tenant.config";
import { getSupabase } from "@/lib/supabase";
import {
  DEFAULT_TENANT_ID,
  defaultLogoUrlForTenant,
  defaultThemeConfig,
  isLoungeTenantId,
  isThemePresetId,
  normalizeTenantCategory,
  parseThemeConfig,
  resolveLogoUrl,
  resolveTenantId,
  themeConfigFromPreset,
} from "@/lib/tenant";
import { resolveTenantCategory } from "@/lib/landingCopy";

export interface CampaignSettings {
  hook: string;
  alternativePerk: string;
  durationMinutes: number;
  baristaPin: string;
  adminPassword: string;
  active: boolean;
  ctaText: string;
  googleReviewUrl: string;
  instagramUrl: string;
  landingKicker: string;
  landingGreeting: string;
  landingAccent: string;
  landingSubhead: string;
  heroTitle: string;
  heroSubtitle: string;
  brandName: string;
  location: string;
  logoUrl: string;
  category: TenantCategory;
  themePreset: ThemePresetId;
  themeConfig: TenantThemeConfig;
  questions: CompassQuestion[];
  products: CampaignProduct[];
  wheelPrizes: WheelPrize[];
  talkCategories: TalkCategory[];
  enabledGames: EnabledGames;
  revision?: string;
}

export interface TenantSettingsRow {
  id: string;
  updated_at?: string;
  is_active: boolean | null;
  campaign_title: string | null;
  barista_pin: string | null;
  admin_password?: string | null;
  countdown_minutes: number | null;
  google_review_url: string | null;
  instagram_url: string | null;
  pusula_questions: unknown;
  conversation_cards: unknown;
  products: unknown;
  theme_config?: unknown;
  logo_url?: string | null;
  brand_name?: string | null;
  category?: string | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  enabled_games?: unknown;
}

const EXTRA_PRODUCT_ID = "__extra";
const CAMPAIGN_EVENT = "wl-campaign-updated";

type Listener = () => void;

const listeners = new Set<Listener>();
let memory: CampaignSettings | null = null;
let activeTenantId = DEFAULT_TENANT_ID;

export function cloneQuestions(
  questions: readonly CompassQuestion[],
): CompassQuestion[] {
  return questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    title: question.title,
    options: question.options.map((option) => ({ ...option })),
  }));
}

export function questionTitleOf(question: CompassQuestion): string {
  return firstText(question.title, question.prompt);
}

export function optionDescOf(option: CompassOption): string {
  return firstText(option.desc, option.caption);
}

export function defaultQuestions(): CompassQuestion[] {
  return cloneQuestions(tenantConfig.compass.questions);
}

export function defaultWheelPrizes(): WheelPrize[] {
  return tenantConfig.wheel.prizes.map((prize) => ({ ...prize }));
}

const OPTION_TAG_BY_ID: Record<string, string> = {
  iced: "Soğuk",
  hot: "Sıcak",
  milky: "Sütlü",
  clear: "Sade",
  sweet: "Yoğun",
  fruity: "Hafif",
};

export function defaultProducts(): CampaignProduct[] {
  return tenantConfig.compass.recipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.originNote,
    imageUrl: "",
    tags: Object.values(recipe.profile).map(
      (value) => OPTION_TAG_BY_ID[value] ?? value,
    ),
    match_tags: Object.values(recipe.profile).map(
      (value) => OPTION_TAG_BY_ID[value] ?? value,
    ),
    tagline: recipe.originNote,
    tastingNotes: [...recipe.notes],
  }));
}

export function optionTagOf(option: CompassOption): string {
  const trimmed = option.tag?.trim();
  if (trimmed) return trimmed;
  return OPTION_TAG_BY_ID[option.id] ?? option.id;
}

export function optionMatchesChoice(
  option: CompassOption,
  choice: string | null | undefined,
): boolean {
  if (!choice) return false;
  return option.id === choice || optionTagOf(option) === choice;
}

export function matchTagsOf(product: CampaignProduct): string[] {
  const raw =
    Array.isArray(product.match_tags) && product.match_tags.length > 0
      ? product.match_tags
      : product.tags;
  return (raw ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function collectQuestionTags(questions: CompassQuestion[]): string[] {
  const tags = new Set<string>();
  questions.forEach((question) => {
    question.options.forEach((option) => {
      const tag = optionTagOf(option);
      if (tag) tags.add(tag);
    });
  });
  return [...tags];
}

export function defaultTalkCategories(): TalkCategory[] {
  return tenantConfig.talk.categories.map((category) => ({
    ...category,
    prompts: category.prompts.map((prompt) => ({ ...prompt })),
  }));
}

const DUEL_GAME_IDS: DuelGameId[] = ["trivia", "emoji", "swipe", "number"];

export function defaultEnabledGames(): EnabledGames {
  return { ...tenantConfig.duel.enabledGames };
}

function parseEnabledGames(raw: unknown, fallback = defaultEnabledGames()): EnabledGames {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...fallback };
  const stored = raw as Partial<Record<DuelGameId, unknown>>;
  return Object.fromEntries(
    DUEL_GAME_IDS.map((id) => [
      id,
      typeof stored[id] === "boolean" ? stored[id] : fallback[id],
    ]),
  ) as EnabledGames;
}

export function talkPromptsOf(
  categories: TalkCategory[] | undefined,
  categoryId: string | null | undefined,
): TalkPrompt[] {
  const list = categories ?? defaultTalkCategories();
  const category = list.find((item) => item.id === categoryId);
  return (category?.prompts ?? []).filter((prompt) => prompt.text.trim());
}

export function activeWheelPrizes(
  prizes: WheelPrize[] | undefined,
): WheelPrize[] {
  return (prizes ?? defaultWheelPrizes()).filter(
    (prize) => prize.active && prize.label.trim(),
  );
}

export function buildCtaFromHook(hook: string): string {
  const trimmed = hook.replace(/[.!…]+$/u, "").trim() || hook.trim();
  return tenantConfig.copy.match.ctaTemplate.replace("{hook}", trimmed);
}

function resolveCtaText(stored: string, fallback: string): string {
  if (!stored) return fallback;
  if (
    /taşırmadan doldur|şansımı deneyeyim|çark|naber/i.test(stored)
  ) {
    return fallback;
  }
  return stored;
}

function resolveHook(stored: string, fallback: string): string {
  if (!stored) return fallback;
  if (/beyaz çikolatalı brownie|sadece 35/i.test(stored)) return fallback;
  return stored;
}

const LEGACY_WHEEL_LABELS = new Set([
  "Fırından Brownie 35 TL",
  "Ücretsiz Büyük Boy",
  "Yanına Cookie 25 TL",
  "Ekstra Shot / Şurup",
  "Kruvasanda %20",
  "Baristanın Sürprizi",
]);

function parsePrizes(raw: unknown): WheelPrize[] {
  const defaults = defaultWheelPrizes();
  const defaultsById = new Map(defaults.map((prize) => [prize.id, prize]));
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const parsed = raw
    .map((item, index): WheelPrize | null => {
      const prize = item as Partial<WheelPrize>;
      const id =
        typeof prize.id === "string" && prize.id.trim()
          ? prize.id.trim()
          : `prize-${index + 1}`;
      const fallback = defaultsById.get(id);
      const storedLabel = typeof prize.label === "string" ? prize.label.trim() : "";
      const useDefaultShort =
        Boolean(fallback) && (!storedLabel || LEGACY_WHEEL_LABELS.has(storedLabel));
      const label = useDefaultShort
        ? fallback!.label
        : storedLabel || tenantConfig.copy.admin.wheelEmptyLabel;
      const caption =
        typeof prize.caption === "string" ? prize.caption.trim() : "";
      const icon =
        typeof prize.icon === "string" && prize.icon.trim()
          ? prize.icon.trim()
          : fallback?.icon ?? "";
      const color =
        typeof prize.color === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(prize.color)
          ? prize.color
          : tenantConfig.wheel.palette[index % tenantConfig.wheel.palette.length];

      if (!label && !caption) return null;

      return {
        id,
        icon,
        label,
        caption: caption || fallback?.caption || label,
        color,
        active: typeof prize.active === "boolean" ? prize.active : true,
      };
    })
    .filter((prize): prize is WheelPrize => prize !== null);

  if (parsed.length === 0) return defaults;

  const activeCount = parsed.filter((prize) => prize.active).length;
  if (activeCount >= tenantConfig.wheel.minActive) return parsed;

  return parsed.map((prize, index) =>
    index < tenantConfig.wheel.minActive ? { ...prize, active: true } : prize,
  );
}

export function defaultCampaign(tenantId: string = DEFAULT_TENANT_ID): CampaignSettings {
  const id = resolveTenantId(tenantId);
  return {
    hook: tenantConfig.reward.hook,
    alternativePerk: tenantConfig.reward.alternativePerk,
    durationMinutes: tenantConfig.reward.durationMinutes,
    baristaPin: tenantConfig.reward.baristaPin,
    adminPassword: "",
    active: tenantConfig.reward.active,
    ctaText: tenantConfig.reward.ctaText,
    googleReviewUrl: tenantConfig.reward.googleReviewUrl,
    instagramUrl: tenantConfig.reward.instagramUrl,
    landingKicker: tenantConfig.copy.landing.kicker,
    landingGreeting: "",
    landingAccent: "",
    landingSubhead: "",
    heroTitle: "",
    heroSubtitle: "",
    brandName: tenantConfig.brand.name,
    location: tenantConfig.brand.location,
    logoUrl: defaultLogoUrlForTenant(id) || tenantConfig.brand.logoUrl,
    category: "cafe",
    themePreset: isLoungeTenantId(id) ? "lounge" : "terracotta",
    themeConfig: {
      ...(isLoungeTenantId(id)
        ? themeConfigFromPreset("lounge")
        : defaultThemeConfig()),
      logo_shape: isLoungeTenantId(id) ? "circle" : "square",
    },
    questions: defaultQuestions(),
    products: defaultProducts(),
    wheelPrizes: defaultWheelPrizes(),
    talkCategories: defaultTalkCategories(),
    enabledGames: defaultEnabledGames(),
  };
}

const SERVER_CAMPAIGN = defaultCampaign();

export function getServerCampaign(): CampaignSettings {
  return SERVER_CAMPAIGN;
}

function emit() {
  listeners.forEach((listener) => listener());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CAMPAIGN_EVENT));
  }
}

function applyCampaign(next: CampaignSettings) {
  memory = next;
  emit();
}

export function subscribeToCampaign(listener: Listener): () => void {
  listeners.add(listener);
  ensureRemoteSync();
  return () => {
    listeners.delete(listener);
  };
}

const COMPASS_ICONS: CompassIcon[] = [
  "snowflake",
  "flame",
  "milk",
  "droplets",
  "cookie",
  "cherry",
  "coffee",
  "flower",
];

function isCompassIcon(value: unknown): value is CompassIcon {
  return typeof value === "string" && COMPASS_ICONS.includes(value as CompassIcon);
}

function parseOption(raw: unknown, index: number): CompassOption | null {
  if (!raw || typeof raw !== "object") return null;
  const stored = raw as Partial<CompassOption> & Record<string, unknown>;
  const label = firstText(stored.label);
  const id =
    firstText(stored.id, stored.tag) || (label ? `option-${index + 1}` : "");
  if (!id && !label) return null;
  const desc = firstText(stored.desc, stored.caption);
  return {
    id: id || `option-${index + 1}`,
    icon: isCompassIcon(stored.icon) ? stored.icon : "coffee",
    label,
    caption: desc,
    desc,
    tag: firstText(stored.tag) || id || label,
  };
}

function parseQuestions(raw: unknown): CompassQuestion[] {
  const defaults = defaultQuestions();
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const parsed = raw
    .map((item, index): CompassQuestion | null => {
      if (!item || typeof item !== "object") return null;
      const stored = item as Partial<CompassQuestion> & Record<string, unknown>;
      const storedOptions = Array.isArray(stored.options) ? stored.options : [];
      const options = storedOptions
        .map((option, optionIndex) => parseOption(option, optionIndex))
        .filter((option): option is CompassOption => Boolean(option));
      const title = firstText(stored.title, stored.prompt);
      if (!title && options.length === 0) return null;
      return {
        id: firstText(stored.id) || `question-${index + 1}`,
        prompt: title,
        title,
        options,
      };
    })
    .filter((question): question is CompassQuestion => Boolean(question));

  return parsed.length > 0 ? parsed : defaults;
}

function serializeQuestions(questions: CompassQuestion[]): CompassQuestion[] {
  return questions.map((question) => {
    const title = questionTitleOf(question);
    return {
      ...question,
      title,
      prompt: title,
      options: question.options.map(serializeOption),
    };
  });
}

function serializeOption(option: CompassOption): CompassOption {
  const desc = optionDescOf(option);
  return { ...option, caption: desc, desc };
}

function parseTalkPrompt(
  raw: Partial<TalkPrompt> | undefined,
  index: number,
  fallback?: TalkPrompt,
): TalkPrompt | null {
  const text = typeof raw?.text === "string" ? raw.text.trim() : "";
  if (!text && !fallback) return null;
  const kind =
    raw?.kind === "write" || raw?.kind === "redflag"
      ? raw.kind
      : fallback?.kind ?? "write";
  return {
    id:
      typeof raw?.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : fallback?.id ?? `talk-${index + 1}`,
    text: text || fallback?.text || "",
    kind,
  };
}

function parseTalkCategories(raw: unknown): TalkCategory[] {
  const defaults = defaultTalkCategories();
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const byId = new Map(
    raw
      .filter((item): item is Partial<TalkCategory> => Boolean(item) && typeof item === "object")
      .map((item) => [item.id, item]),
  );

  return defaults.map((fallback) => {
    const stored = byId.get(fallback.id);
    const promptsRaw = stored?.prompts;
    const parsedPrompts = Array.isArray(promptsRaw)
      ? promptsRaw
          .map((item, index) =>
            parseTalkPrompt(item as Partial<TalkPrompt>, index, fallback.prompts[index]),
          )
          .filter((prompt): prompt is TalkPrompt => Boolean(prompt?.text.trim()))
      : [];

    const legacyMix = fallback.id === "mix-table" && isLegacyMixTable(stored, parsedPrompts);

    return {
      ...fallback,
      title:
        legacyMix || !(typeof stored?.title === "string" && stored.title.trim())
          ? fallback.title
          : stored.title.trim(),
      caption:
        legacyMix || !(typeof stored?.caption === "string" && stored.caption.trim())
          ? fallback.caption
          : stored.caption.trim(),
      icon:
        legacyMix || !(typeof stored?.icon === "string" && stored.icon.trim())
          ? fallback.icon
          : stored.icon.trim(),
      prompts: shouldUseTalkFallback(fallback, stored, parsedPrompts)
        ? fallback.prompts
        : parsedPrompts,
    };
  });
}

function isLegacyMixTable(
  stored: Partial<TalkCategory> | undefined,
  prompts: TalkPrompt[],
): boolean {
  if (stored?.title === "Masayı Karıştır") return true;
  return prompts.some((prompt) => prompt.id.startsWith("mx-"));
}

function shouldUseTalkFallback(
  fallback: TalkCategory,
  stored: Partial<TalkCategory> | undefined,
  parsedPrompts: TalkPrompt[],
): boolean {
  if (parsedPrompts.length < tenantConfig.talk.minPrompts) return true;
  if (isLegacyMixTable(stored, parsedPrompts) && fallback.id === "mix-table") {
    return true;
  }
  return isLegacyWriteDeck(fallback.id, parsedPrompts);
}

const LEGACY_WRITE_TEXTS = new Set([
  "Bu masada ilk fark ettiğin ayrıntı neydi — ve neden aklında kaldı?",
  "Kahven senin yerine konuşsa, hakkımda ne sorardı?",
  "İlk tanışmada asla söylemeyeceğin cümleyi, şimdi fısılda.",
  "Ben sabah insanı mıyım, gece kuşu mu? Gerekçenle söyle.",
]);

function isLegacyWriteDeck(categoryId: string, prompts: TalkPrompt[]): boolean {
  if (categoryId !== "first-look" && categoryId !== "how-well") return false;
  return prompts.filter((prompt) => LEGACY_WRITE_TEXTS.has(prompt.text)).length >= 2;
}

export function talkCategoriesValid(categories: TalkCategory[]): boolean {
  return categories.every(
    (category) =>
      category.prompts.filter((prompt) => prompt.text.trim()).length >=
      tenantConfig.talk.minPrompts,
  );
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseHeroCopy(
  raw: Partial<CampaignSettings> | Record<string, unknown>,
): Pick<CampaignSettings, "heroTitle" | "heroSubtitle" | "landingGreeting" | "landingSubhead"> {
  const heroTitle = firstText(raw.heroTitle, raw.landingGreeting);
  const heroSubtitle = firstText(raw.heroSubtitle, raw.landingSubhead);
  return {
    heroTitle,
    heroSubtitle,
    landingGreeting: heroTitle,
    landingSubhead: heroSubtitle,
  };
}

function parseIdentity(
  raw: Partial<CampaignSettings> | Record<string, unknown>,
  defaults: CampaignSettings,
  tenantId: string = DEFAULT_TENANT_ID,
): Pick<
  CampaignSettings,
  "brandName" | "location" | "logoUrl" | "category" | "themePreset" | "themeConfig"
> {
  const brandName =
    typeof raw.brandName === "string" && raw.brandName.trim()
      ? raw.brandName.trim()
      : "";
  const location =
    typeof raw.location === "string" ? raw.location.trim() : "";
  const logoUrl = resolveLogoUrl(
    typeof raw.logoUrl === "string" ? raw.logoUrl.trim() : "",
    tenantId,
  );
  const presetFallback = isThemePresetId(raw.themePreset)
    ? themeConfigFromPreset(raw.themePreset)
    : defaults.themeConfig;
  const themeConfig = parseThemeConfig(raw.themeConfig, presetFallback);
  const themePreset = themeConfig.preset;
  const category = resolveTenantCategory(raw.category);

  return { brandName, location, logoUrl, category, themePreset, themeConfig };
}

function parseCampaign(raw: string): CampaignSettings | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CampaignSettings>;
    const defaults = defaultCampaign(getActiveTenantId());
    const pin = String(parsed.baristaPin ?? defaults.baristaPin).replace(/\D/g, "");
    const duration = Number(parsed.durationMinutes);
    const storedHook =
      typeof parsed.hook === "string" ? parsed.hook.trim() : "";
    const hook = resolveHook(storedHook, defaults.hook);
    const storedCta =
      typeof parsed.ctaText === "string" ? parsed.ctaText.trim() : "";

    return {
      hook,
      alternativePerk:
        (parsed.alternativePerk ?? defaults.alternativePerk).trim() ||
        defaults.alternativePerk,
      durationMinutes:
        Number.isFinite(duration) && duration >= 1 && duration <= 120
          ? Math.round(duration)
          : defaults.durationMinutes,
      baristaPin: pin.length === 4 ? pin : defaults.baristaPin,
      adminPassword:
        typeof parsed.adminPassword === "string" ? parsed.adminPassword.trim() : "",
      active: typeof parsed.active === "boolean" ? parsed.active : defaults.active,
      ctaText: resolveCtaText(storedCta, defaults.ctaText),
      googleReviewUrl:
        typeof parsed.googleReviewUrl === "string" && parsed.googleReviewUrl.trim()
          ? parsed.googleReviewUrl.trim()
          : defaults.googleReviewUrl,
      instagramUrl:
        typeof parsed.instagramUrl === "string" && parsed.instagramUrl.trim()
          ? parsed.instagramUrl.trim()
          : defaults.instagramUrl,
      landingKicker:
        typeof parsed.landingKicker === "string" && parsed.landingKicker.trim()
          ? parsed.landingKicker.trim()
          : defaults.landingKicker,
      landingAccent:
        typeof parsed.landingAccent === "string" && parsed.landingAccent.trim()
          ? parsed.landingAccent.trim()
          : "",
      ...parseHeroCopy(parsed),
      ...parseIdentity(parsed, defaults, getActiveTenantId()),
      questions: parseQuestions(parsed.questions),
      products: parseProducts(parsed.products),
      wheelPrizes: parsePrizes(parsed.wheelPrizes),
      talkCategories: parseTalkCategories(parsed.talkCategories),
      enabledGames: parseEnabledGames(parsed.enabledGames, defaults.enabledGames),
    };
  } catch {
    return null;
  }
}

export function getActiveTenantId(): string {
  return activeTenantId;
}

export function primeTenant(tenantId: string, initial?: CampaignSettings): void {
  const nextId = resolveTenantId(tenantId);
  const changed = nextId !== activeTenantId;
  activeTenantId = nextId;
  if (changed) {
    memory = initial ?? defaultCampaign(nextId);
    return;
  }
  if (!memory && initial) {
    memory = initial;
  }
}

export function getCampaignSettings(): CampaignSettings {
  return memory ?? SERVER_CAMPAIGN;
}

export async function saveCampaign(next: CampaignSettings): Promise<CampaignSettings> {
  const normalized = parseCampaign(JSON.stringify(next)) ?? defaultCampaign(getActiveTenantId());
  const saved = await persistTenantRow(normalized);
  applyCampaign(saved);
  return saved;
}

export async function resetCampaign(): Promise<CampaignSettings> {
  const saved = await persistTenantRow(defaultCampaign(getActiveTenantId()));
  applyCampaign(saved);
  return saved;
}

function questionsFromRemote(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "items" in raw) {
    return (raw as { items: unknown }).items;
  }
  return raw;
}

function parseTastingNotes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseTagList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseProducts(raw: unknown): CampaignProduct[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultProducts();

  const parsed = raw
    .map((item, index): CampaignProduct | null => {
      if (!item || typeof item !== "object") return null;
      const product = item as Partial<CampaignProduct> & {
        id?: string;
        tasting_notes?: unknown;
        match_tags?: unknown;
      };
      if (product.id === EXTRA_PRODUCT_ID) return null;
      const name = typeof product.name === "string" ? product.name.trim() : "";
      if (!name) return null;
      const matchTags = parseTagList(product.match_tags);
      const tags = matchTags.length > 0 ? matchTags : parseTagList(product.tags);
      return {
        id:
          typeof product.id === "string" && product.id.trim()
            ? product.id.trim()
            : `product-${index + 1}`,
        name,
        description:
          typeof product.description === "string" ? product.description.trim() : "",
        imageUrl:
          typeof product.imageUrl === "string" ? product.imageUrl.trim() : "",
        tags,
        match_tags: tags,
        tagline: firstText(product.tagline),
        tastingNotes: parseTastingNotes(
          product.tastingNotes ?? product.tasting_notes,
        ),
        accentColor: firstText(
          product.accentColor,
          (product as { accent_color?: unknown }).accent_color,
        ),
      };
    })
    .filter((product): product is CampaignProduct => Boolean(product));

  return parsed.length > 0 ? parsed : defaultProducts();
}

function extraFromProducts(raw: unknown): Partial<CampaignSettings> {
  if (!Array.isArray(raw)) return {};
  const extra = raw.find(
    (item) =>
      item &&
      typeof item === "object" &&
      "id" in item &&
      (item as { id?: string }).id === EXTRA_PRODUCT_ID,
  ) as Partial<CampaignSettings> & { id?: string } | undefined;
  if (!extra) return {};
  const { id: _id, ...rest } = extra;
  return rest;
}

export function campaignFromRow(row: TenantSettingsRow): CampaignSettings {
  const defaults = defaultCampaign(row.id);
  const extra = extraFromProducts(row.products);
  const pin = String(row.barista_pin ?? defaults.baristaPin).replace(/\D/g, "");
  const duration = Number(row.countdown_minutes);
  const hook = resolveHook(
    typeof row.campaign_title === "string" ? row.campaign_title.trim() : "",
    defaults.hook,
  );

  return {
    ...defaults,
    ...extra,
    hook,
    alternativePerk:
      extra.alternativePerk?.trim() || defaults.alternativePerk,
    durationMinutes:
      Number.isFinite(duration) && duration >= 1 && duration <= 120
        ? Math.round(duration)
        : defaults.durationMinutes,
    baristaPin: pin.length === 4 ? pin : defaults.baristaPin,
    adminPassword: firstText(
      "admin_password" in row ? row.admin_password : "",
      extra.adminPassword,
    ),
    active: typeof row.is_active === "boolean" ? row.is_active : defaults.active,
    ctaText: resolveCtaText(extra.ctaText?.trim() ?? "", defaults.ctaText),
    googleReviewUrl:
      typeof row.google_review_url === "string" && row.google_review_url.trim()
        ? row.google_review_url.trim()
        : defaults.googleReviewUrl,
    instagramUrl:
      typeof row.instagram_url === "string" && row.instagram_url.trim()
        ? row.instagram_url.trim()
        : defaults.instagramUrl,
    landingKicker: extra.landingKicker?.trim() || defaults.landingKicker,
    landingAccent: extra.landingAccent?.trim() || "",
    ...parseHeroCopy({
      heroTitle:
        "hero_title" in row
          ? row.hero_title
          : firstText(extra.heroTitle, extra.landingGreeting),
      heroSubtitle:
        "hero_subtitle" in row
          ? row.hero_subtitle
          : firstText(extra.heroSubtitle, extra.landingSubhead),
    }),
    ...parseIdentity(
      {
        ...extra,
        brandName:
          (typeof row.brand_name === "string" && row.brand_name.trim()) ||
          extra.brandName,
        location:
          typeof extra.location === "string"
            ? extra.location
            : row.id === DEFAULT_TENANT_ID
              ? defaults.location
              : "",
        logoUrl:
          typeof row.logo_url === "string"
            ? row.logo_url
            : extra.logoUrl,
        category:
          [row.category, extra.category].find(
            (value) => normalizeTenantCategory(value) !== null,
          ) ?? extra.category,
        themeConfig: extra.themeConfig ?? row.theme_config,
        themePreset:
          extra.themePreset ??
          (row.theme_config &&
          typeof row.theme_config === "object" &&
          "preset" in row.theme_config
            ? (row.theme_config as { preset?: unknown }).preset
            : undefined),
      },
      defaults,
      row.id,
    ),
    questions: parseQuestions(questionsFromRemote(row.pusula_questions)),
    products: parseProducts(row.products),
    wheelPrizes: extra.wheelPrizes
      ? parsePrizes(extra.wheelPrizes)
      : defaults.wheelPrizes,
    talkCategories: parseTalkCategories(row.conversation_cards),
    enabledGames: parseEnabledGames(
      "enabled_games" in row && row.enabled_games != null
        ? row.enabled_games
        : extra.enabledGames,
      defaults.enabledGames,
    ),
    revision: row.updated_at,
  };
}

export function campaignToRow(settings: CampaignSettings): Omit<TenantSettingsRow, "id"> {
  const preset = isThemePresetId(settings.themeConfig?.preset)
    ? settings.themeConfig.preset
    : isThemePresetId(settings.themePreset)
      ? settings.themePreset
      : parseThemeConfig(settings.themeConfig).preset;
  const themeConfig = parseThemeConfig(
    {
      ...settings.themeConfig,
      preset,
    },
    themeConfigFromPreset(preset),
  );
  return {
    is_active: settings.active,
    campaign_title: settings.hook,
    barista_pin: settings.baristaPin,
    admin_password: settings.adminPassword.trim(),
    countdown_minutes: settings.durationMinutes,
    google_review_url: settings.googleReviewUrl,
    instagram_url: settings.instagramUrl,
    pusula_questions: serializeQuestions(settings.questions),
    conversation_cards: settings.talkCategories,
    theme_config: themeConfig,
    logo_url: settings.logoUrl,
    brand_name: settings.brandName,
    category: settings.category,
    hero_title: settings.heroTitle,
    hero_subtitle: settings.heroSubtitle,
    enabled_games: settings.enabledGames,
    products: [
      ...settings.products.map((product) => {
        const tastingNotes = (product.tastingNotes ?? [])
          .map((note) => note.trim())
          .filter(Boolean);
        return {
          ...product,
          tags: matchTagsOf(product),
          match_tags: matchTagsOf(product),
          tastingNotes,
          tasting_notes: tastingNotes,
          accent_color: product.accentColor ?? "",
        };
      }),
      {
        id: EXTRA_PRODUCT_ID,
        ctaText: settings.ctaText,
        alternativePerk: settings.alternativePerk,
        landingKicker: settings.landingKicker,
        landingGreeting: settings.heroTitle || settings.landingGreeting,
        landingAccent: settings.landingAccent,
        landingSubhead: settings.heroSubtitle || settings.landingSubhead,
        heroTitle: settings.heroTitle,
        heroSubtitle: settings.heroSubtitle,
        brandName: settings.brandName,
        location: settings.location,
        logoUrl: settings.logoUrl,
        category: settings.category,
        themePreset: themeConfig.preset,
        themeConfig,
        wheelPrizes: settings.wheelPrizes,
        adminPassword: settings.adminPassword.trim(),
        enabledGames: settings.enabledGames,
      },
    ],
    updated_at: new Date().toISOString(),
  };
}

function tenantSettingsUrl(tenantId = activeTenantId): string {
  return `/api/tenant-settings?id=${encodeURIComponent(resolveTenantId(tenantId))}`;
}

async function fetchTenantRow(): Promise<TenantSettingsRow | null> {
  try {
    const res = await fetch(tenantSettingsUrl(), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as TenantSettingsRow;
  } catch {
    return null;
  }
}

export async function fetchTenantRowServer(
  tenantId: string,
): Promise<TenantSettingsRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("tenant_settings")
    .select("*")
    .eq("id", resolveTenantId(tenantId))
    .maybeSingle();
  if (error || !data) return null;
  return data as TenantSettingsRow;
}

async function persistTenantRow(settings: CampaignSettings): Promise<CampaignSettings> {
  const res = await fetch(tenantSettingsUrl(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    throw new Error(`supabase-update-failed:${res.status}`);
  }
  return campaignFromRow((await res.json()) as TenantSettingsRow);
}

let syncStarted = false;
let syncedTenantId: string | null = null;
let realtimeCleanup: (() => void) | null = null;

async function hydrateFromSupabase() {
  const row = await fetchTenantRow();
  if (!row) return;
  applyCampaign(campaignFromRow(row));
}

function teardownRealtime() {
  realtimeCleanup?.();
  realtimeCleanup = null;
}

function startRealtime(tenantId: string) {
  const supabase = getSupabase();
  if (!supabase || realtimeCleanup) return;

  const topic = `tenant-settings:${tenantId}`;
  supabase.getChannels().forEach((channel) => {
    if (channel.topic === topic || channel.topic.endsWith(`:${topic}`)) {
      void supabase.removeChannel(channel);
    }
  });

  const channel = supabase
    .channel(topic)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tenant_settings",
        filter: `id=eq.${tenantId}`,
      },
      (payload) => {
        const row = payload.new as TenantSettingsRow | undefined;
        if (!row?.id || row.id !== activeTenantId) return;
        applyCampaign(campaignFromRow(row));
      },
    )
    .subscribe();

  const onFocus = () => {
    void hydrateFromSupabase();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
  }

  realtimeCleanup = () => {
    void supabase.removeChannel(channel);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onFocus);
    }
  };
}

function ensureRemoteSync() {
  if (typeof window === "undefined") return;
  if (syncStarted && syncedTenantId === activeTenantId) return;
  teardownRealtime();
  syncStarted = true;
  syncedTenantId = activeTenantId;
  void hydrateFromSupabase();
  startRealtime(activeTenantId);
}

export function bindTenant(tenantId: string, initial?: CampaignSettings): void {
  const previous = activeTenantId;
  primeTenant(tenantId, initial);
  if (previous !== activeTenantId) emit();
  ensureRemoteSync();
}

export function campaignDurationMs(settings = getCampaignSettings()): number {
  return settings.durationMinutes * 60 * 1000;
}

export function isValidBaristaPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function isValidAdminPassword(password: string): boolean {
  const trimmed = password.trim();
  return trimmed.length === 0 || trimmed.length >= 4;
}

export function isValidDuration(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 120;
}
