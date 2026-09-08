"use client";

import {
  Coffee,
  Compass,
  Flame,
  Leaf,
  Moon,
  Snowflake,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { CompassOption, TenantCategory } from "@/config/tenant.config";
import { optionTagOf } from "@/lib/campaignState";
import { resolveTenantCategory } from "@/lib/landingCopy";

type OptionIconProps = {
  option: CompassOption;
  category?: TenantCategory | string;
  className?: string;
  color?: string;
};

function haystackOf(option: CompassOption): string {
  return [optionTagOf(option), option.label, option.desc, option.caption]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

export function iconForOption(
  option: CompassOption,
  category?: TenantCategory | string,
): LucideIcon {
  const haystack = haystackOf(option);
  const tag = optionTagOf(option).toLocaleLowerCase("tr-TR");
  const venue = resolveTenantCategory(category);

  if (
    tag === "ice" ||
    haystack.includes("buz") ||
    haystack.includes("soğuk") ||
    haystack.includes("soguk")
  ) {
    return Snowflake;
  }
  if (tag === "berry" || tag === "tropical" || haystack.includes("meyve")) {
    return Leaf;
  }
  if (
    tag === "soft" ||
    haystack.includes("dinleme") ||
    haystack.includes("sakinlik") ||
    haystack.includes("sakin")
  ) {
    return Moon;
  }
  if (
    tag === "social" ||
    haystack.includes("muhabbet") ||
    haystack.includes("enerji")
  ) {
    return Flame;
  }
  if (
    tag === "party" ||
    haystack.includes("kutlama") ||
    haystack.includes("keyif")
  ) {
    return Sparkles;
  }
  if (venue === "cafe") return Coffee;
  if (venue === "food") return UtensilsCrossed;
  return Compass;
}

export function OptionIcon({ option, category, className, color }: OptionIconProps) {
  const Icon = iconForOption(option, category);
  return (
    <Icon
      className={className}
      aria-hidden
      style={color ? { color } : undefined}
    />
  );
}
