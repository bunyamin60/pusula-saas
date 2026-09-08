import {
  tenantConfig,
  type LogoShape,
  type TenantCategory,
  type TenantThemeConfig,
  type ThemePresetId,
  type ThemeTokens,
} from "@/config/tenant.config";

export const DEFAULT_TENANT_ID: string = tenantConfig.id;

const PRESET_IDS: ThemePresetId[] = [
  "lounge",
  "cyberpunk",
  "velvet",
  "terracotta",
  "matcha",
  "slate",
];
const LOUNGE_PRESETS: ThemePresetId[] = ["lounge", "cyberpunk", "velvet", "slate"];
const LOGO_SHAPES: LogoShape[] = ["circle", "square"];

const INK_ON_DARK = "#F8FAFC";
const MUTED_ON_DARK = "#D6D3D1";
const INK_ON_LIGHT = "#1A1716";
const MUTED_ON_LIGHT = "#7A726D";

export function sanitizeTenantId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(id)) return null;
  const reserved = new Set(["admin", "api", "favicon.ico"]);
  if (reserved.has(id.toLowerCase())) return null;
  return id;
}

export function resolveTenantId(raw: string | null | undefined): string {
  return sanitizeTenantId(raw) ?? DEFAULT_TENANT_ID;
}

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === "string" && PRESET_IDS.includes(value as ThemePresetId);
}

export function normalizeTenantCategory(value: unknown): TenantCategory | null {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase();
  if (id === "cafe" || id === "coffee") return "cafe";
  if (id === "lounge") return "lounge";
  if (id === "food" || id === "burger") return "food";
  if (id === "general") return "general";
  return null;
}

export function isTenantCategory(value: unknown): value is TenantCategory {
  return normalizeTenantCategory(value) !== null;
}

export function isLoungeExperience(category: TenantCategory): boolean {
  return category === "lounge";
}

export function defaultLogoUrlForTenant(tenantId: string): string {
  const assets = tenantConfig.brandAssets as Record<string, { logoUrl: string }>;
  return assets[tenantId]?.logoUrl ?? "";
}

export function resolveLogoUrl(
  stored: string | null | undefined,
  tenantId: string,
): string {
  const fallback = defaultLogoUrlForTenant(tenantId);
  const value = (stored ?? "").trim();
  if (!value) return fallback;
  if (tenantId !== tenantConfig.id && value === tenantConfig.brand.logoUrl) {
    return fallback;
  }
  return value;
}

export function defaultAdminPassword(tenantId: string): string {
  const map = tenantConfig.adminPasswords as Record<string, string>;
  return map[tenantId] ?? tenantConfig.admin.password;
}

export function isLoungeTenantId(tenantId: string): boolean {
  return (tenantConfig.loungeTenantIds as readonly string[]).includes(tenantId);
}

export function isLogoShape(value: unknown): value is LogoShape {
  return typeof value === "string" && LOGO_SHAPES.includes(value as LogoShape);
}

export function defaultLogoShape(tenantId: string): LogoShape {
  return isLoungeTenantId(tenantId) ? "circle" : "square";
}

export function resolveLogoShape(
  stored: unknown,
  tenantId: string,
): LogoShape {
  if (isLogoShape(stored)) return stored;
  return defaultLogoShape(tenantId);
}

export function logoFrameClass(shape: LogoShape, size: "compact" | "hero" = "compact"): string {
  if (shape === "circle") {
    return size === "hero"
      ? "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40"
      : "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40";
  }
  return size === "hero"
    ? "flex h-24 w-auto max-w-[220px] shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-sm"
    : "flex h-14 w-auto max-w-[140px] shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-sm";
}

export function logoImageClass(shape: LogoShape): string {
  return shape === "circle"
    ? "h-full w-full object-cover"
    : "h-full w-auto max-h-full object-contain";
}

export function categoryFromPreset(preset: ThemePresetId): TenantCategory {
  return LOUNGE_PRESETS.includes(preset) ? "lounge" : "cafe";
}

export function contrastOn(background: string): { ink: string; muted: string } {
  if (isDarkHex(background)) {
    return { ink: INK_ON_DARK, muted: MUTED_ON_DARK };
  }
  return { ink: INK_ON_LIGHT, muted: MUTED_ON_LIGHT };
}

export function defaultThemeConfig(): TenantThemeConfig {
  const preset = tenantConfig.themePresets.terracotta;
  return { preset: "terracotta", ...preset.config };
}

export function themeConfigFromPreset(id: ThemePresetId): TenantThemeConfig {
  const preset = tenantConfig.themePresets[id] ?? tenantConfig.themePresets.terracotta;
  return { preset: id, ...preset.config };
}

export function parseThemeConfig(raw: unknown, fallback?: TenantThemeConfig): TenantThemeConfig {
  const base = fallback ?? defaultThemeConfig();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<TenantThemeConfig>;
  const preset = isThemePresetId(value.preset) ? value.preset : base.preset;
  const fromPreset = themeConfigFromPreset(preset);
  return {
    preset,
    primary: hexColor(value.primary) ?? fromPreset.primary,
    bg: hexColor(value.bg) ?? fromPreset.bg,
    card_bg: hexColor(value.card_bg) ?? fromPreset.card_bg,
    accent: hexColor(value.accent) ?? fromPreset.accent,
    logo_shape: isLogoShape(value.logo_shape)
      ? value.logo_shape
      : isLogoShape(base.logo_shape)
        ? base.logo_shape
        : undefined,
  };
}

export function tokensFromThemeConfig(config?: TenantThemeConfig | null): ThemeTokens {
  const safe = parseThemeConfig(config);
  const preset =
    tenantConfig.themePresets[safe.preset] ?? tenantConfig.themePresets.terracotta;
  const page = contrastOn(safe.bg || preset.tokens.background);
  const card = contrastOn(safe.card_bg || preset.tokens.surface);
  const onPrimary = isDarkHex(safe.primary || preset.tokens.primary)
    ? "#FFF8F4"
    : "#1A1716";
  return {
    ...preset.tokens,
    primary: safe.primary || preset.tokens.primary,
    primaryHover: safe.accent || preset.tokens.primaryHover,
    background: safe.bg || preset.tokens.background,
    surface: safe.card_bg || preset.tokens.surface,
    textDark: page.ink,
    textMuted: page.muted,
    onSurface: card.ink,
    onSurfaceMuted: card.muted,
    onPrimary,
  };
}

export function isDarkHex(hex: string): boolean {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function hexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : null;
}
