"use client";

import Image from "next/image";
import { tenantConfig } from "@/config/tenant.config";

export function LoadingScreen() {
  const message = tenantConfig.copy.loading.message;

  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center bg-[#0a0a0a] px-6">
      <div className="flex flex-col items-center">
        <div className="relative size-48">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary animate-loading-spin"
          />

          <div className="absolute inset-0 overflow-hidden rounded-full">
            <Image
              src="/images/mascot-original.webp"
              alt=""
              fill
              priority
              sizes="192px"
              className="object-cover object-center"
            />
          </div>
        </div>

        <p className="mt-6 animate-pulse text-center font-sans text-sm font-medium tracking-wide text-white/70">
          {message}
        </p>
      </div>
    </div>
  );
}
