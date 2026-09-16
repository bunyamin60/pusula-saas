"use client";

import { tenantConfig } from "@/config/tenant.config";

type ExperienceBackProps = {
  onBack: () => void;
  label?: string;
};

export function ExperienceBack({ onBack, label }: ExperienceBackProps) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex min-h-11 items-center rounded-full px-2 font-sans text-sm font-medium text-[#2d334a] transition-colors hover:bg-[#e3f6f5] hover:text-[#272343]"
    >
      ← {label ?? tenantConfig.copy.landing.home}
    </button>
  );
}
