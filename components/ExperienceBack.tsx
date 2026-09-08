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
      className="inline-flex min-h-11 items-center rounded-full px-2 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
    >
      ← {label ?? tenantConfig.copy.landing.home}
    </button>
  );
}
