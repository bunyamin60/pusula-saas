import { tenantConfig, type ThemeTokens } from "@/config/tenant.config";
import { isDarkHex } from "@/lib/tenant";

function tabActivePair(theme: ThemeTokens): { bg: string; text: string } {
  if (isDarkHex(theme.background)) {
    return { bg: theme.primary, text: theme.onPrimary };
  }
  const bg = isDarkHex(theme.textDark) ? theme.textDark : "#0d0d0d";
  return { bg, text: "#ffffff" };
}

function toKebab(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

export function themeVarEntries(
  theme: ThemeTokens = tenantConfig.theme,
): Array<[string, string]> {
  return [
    ...Object.entries(theme).map(
      ([key, value]) => [`--${toKebab(key)}`, value] as [string, string],
    ),
    ["--bg", theme.background],
    ["--card-bg", theme.surface],
    ["--accent", theme.primaryHover],
    ["--bg-canvas", theme.background],
    ["--logo-well", "#fffffe"],
    ["--text-headline", theme.textDark],
    ["--text-body", theme.textMuted],
    ["--btn-primary", theme.primary],
    ["--btn-text", theme.onPrimary],
    ["--card-surface", theme.surface],
    [
      "--border",
      theme.border ??
        `color-mix(in srgb, ${theme.textDark} 20%, transparent)`,
    ],
    [
      "--card-border",
      theme.border ??
        `color-mix(in srgb, ${theme.textDark} 20%, transparent)`,
    ],
    ["--tab-active-bg", tabActivePair(theme).bg],
    ["--tab-active-text", tabActivePair(theme).text],
  ];
}

export function themeVars(theme: ThemeTokens = tenantConfig.theme): string {
  return themeVarEntries(theme)
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");
}

export function buildThemeCss(theme: ThemeTokens = tenantConfig.theme): string {
  const scheme = isDarkHex(theme.background) ? "dark" : "light";
  return `:root { color-scheme: ${scheme}; ${themeVars(theme)} }`;
}

export function applyThemeTokens(theme: ThemeTokens): void {
  if (typeof document === "undefined") return;
  document.getElementById("arada-theme-boot")?.remove();
  try {
    window.localStorage.removeItem("arada_theme_css");
    window.localStorage.removeItem("arada_theme_vars");
  } catch {
    // Ignore storage access in private browsing.
  }
  const root = document.documentElement;
  root.style.colorScheme = isDarkHex(theme.background) ? "dark" : "light";
  themeVarEntries(theme).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  themeMeta?.setAttribute("content", theme.primary);
}
