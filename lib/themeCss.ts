import { tenantConfig, type ThemeTokens } from "@/config/tenant.config";

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
  ];
}

export function themeVars(theme: ThemeTokens = tenantConfig.theme): string {
  return themeVarEntries(theme)
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");
}

export function buildThemeCss(theme: ThemeTokens = tenantConfig.theme): string {
  return `:root { ${themeVars(theme)} }`;
}

export function applyThemeTokens(theme: ThemeTokens): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  themeVarEntries(theme).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  themeMeta?.setAttribute("content", theme.primary);
}
