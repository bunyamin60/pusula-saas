"use client";

import Image from "next/image";
import { tenantConfig } from "@/config/tenant.config";

const MASCOT_SRC = "/images/maskot-original.webp?v=20260921c";

function CoffeeBean({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 36" aria-hidden className={className} fill="none">
      <defs>
        <linearGradient id="beanFill" x1="6" y1="2" x2="24" y2="34">
          <stop
            offset="0%"
            stopColor="color-mix(in srgb, var(--btn-primary) 78%, var(--logo-well, #fffffe))"
          />
          <stop offset="55%" stopColor="var(--btn-primary)" />
          <stop
            offset="100%"
            stopColor="color-mix(in srgb, var(--btn-primary) 62%, var(--text-headline))"
          />
        </linearGradient>
      </defs>
      <ellipse cx="14" cy="18" rx="10" ry="15" fill="url(#beanFill)" />
      <path
        d="M14 5c-1 3.4-1.2 7.4 0 11.4 1.2 4 1 8.2 0 12.2"
        stroke="color-mix(in srgb, var(--text-headline) 38%, transparent)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <ellipse
        cx="10"
        cy="11"
        rx="2.6"
        ry="1.5"
        fill="color-mix(in srgb, var(--logo-well, #fffffe) 55%, transparent)"
        transform="rotate(-30 10 11)"
      />
    </svg>
  );
}

export function LoadingScreen() {
  const message = tenantConfig.copy.loading.message;

  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center bg-[var(--bg-canvas)] px-6">
      <div className="flex flex-col items-center">
        <div className="relative size-56 sm:size-64">
          <div
            aria-hidden
            className="absolute inset-1 rounded-full border border-[color-mix(in_srgb,var(--btn-primary)_22%,transparent)]"
          />

          {/* Subtle wake + bean */}
          <div
            aria-hidden
            className="loading-orbit absolute inset-0 animate-loading-spin"
          >
            <span
              className="absolute inset-0 opacity-30"
              style={{ transform: "rotate(-26deg)" }}
            >
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 scale-75 blur-[0.5px]">
                <CoffeeBean className="h-5 w-4" />
              </span>
            </span>
            <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm">
              <CoffeeBean className="loading-bean h-6 w-[18px]" />
            </span>
          </div>

          <div className="absolute inset-3 overflow-hidden rounded-full bg-[var(--card-surface)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--btn-primary)_25%,transparent)] sm:inset-3.5">
            <Image
              src={MASCOT_SRC}
              alt=""
              fill
              priority
              unoptimized
              sizes="(max-width: 640px) 208px, 240px"
              className="object-cover object-[center_42%]"
            />
          </div>
        </div>

        <p className="mt-6 animate-pulse text-center font-sans text-sm font-medium tracking-wide text-[var(--text-body)]">
          {message}
        </p>
      </div>
    </div>
  );
}
