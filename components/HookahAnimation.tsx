"use client";

import { tenantConfig } from "@/config/tenant.config";

type HookahAnimationProps = {
  name: string;
  accentColor?: string;
};

function validHex(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : null;
}

export function hookahAccentOf(name: string, accentColor?: string): string {
  const explicit = validHex(accentColor);
  if (explicit) return explicit;

  const haystack = name.toLocaleLowerCase("tr-TR");
  const { ice, berry, mint } = tenantConfig.hookah.accents;

  if (haystack.includes("yaban mersini") || haystack.includes("buz")) return ice;
  if (haystack.includes("love 66") || haystack.includes("çilek")) return berry;
  if (haystack.includes("çift elma") || haystack.includes("nane")) return mint;
  return ice;
}

export function HookahAnimation({ name, accentColor }: HookahAnimationProps) {
  const accent = hookahAccentOf(name, accentColor);

  return (
    <div
      className="hookah-stage"
      style={{ ["--hookah-accent" as string]: accent }}
      aria-hidden
    >
      <div className="hookah-smoke">
        <span />
        <span />
        <span />
      </div>
      <svg className="hookah-mark" viewBox="0 0 120 168" fill="none">
        <ellipse
          className="hookah-glow"
          cx="52"
          cy="138"
          rx="22"
          ry="16"
          fill="var(--hookah-accent)"
          fillOpacity="0.22"
        />
        <path
          d="M30 128c0 14 10 22 22 22s22-8 22-22c0-10-6-18-14-24h-16c-8 6-14 14-14 24Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M36 124c3 10 9 16 16 16 7 0 13-6 16-16"
          stroke="var(--hookah-accent)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M52 104v18"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M44 88h16c3 0 6 2.4 6 6.2 0 6.8-5 9.8-14 9.8s-14-3-14-9.8c0-3.8 3-6.2 6-6.2Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <ellipse
          cx="52"
          cy="86"
          rx="18"
          ry="4.5"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M46 78h12"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <ellipse
          cx="52"
          cy="74"
          rx="7"
          ry="5"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M59 90c16 4 28 6 36-4 6-8 4-18-4-22"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M91 64c-3 2-4 6-2 9"
          stroke="var(--hookah-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="52"
          cy="154"
          r="3"
          fill="var(--hookah-accent)"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}
