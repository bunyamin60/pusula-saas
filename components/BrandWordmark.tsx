"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getActiveTenantId } from "@/lib/campaignState";
import { updateSession } from "@/lib/session";
import {
  logoFrameClass,
  resolveLogoShape,
  resolveLogoUrl,
} from "@/lib/tenant";
import { useCampaign } from "@/lib/useCampaign";

type BrandWordmarkProps = {
  compact?: boolean;
  home?: boolean;
  centered?: boolean;
  markOnly?: boolean;
};

export function BrandWordmark({
  compact = false,
  home = false,
  centered = false,
  markOnly = false,
}: BrandWordmarkProps) {
  const campaign = useCampaign();
  const params = useParams<{ tenant?: string }>();
  const tenantId = params.tenant ?? getActiveTenantId();
  const name = (campaign.brandName ?? "").trim();
  const location = (campaign.location ?? "").trim();
  const logoUrl = resolveLogoUrl(campaign.logoUrl, tenantId);
  const shape = resolveLogoShape(campaign.themeConfig?.logo_shape, tenantId);
  const frameClass = compact
    ? logoFrameClass(shape, "compact")
    : logoFrameClass(shape, "hero");

  const image = logoUrl ? (
    <img
      src={logoUrl}
      alt={name}
      className="h-full w-full object-contain"
    />
  ) : name ? (
    <p
      className={`font-display font-semibold uppercase leading-none tracking-[0.18em] text-ink ${
        compact ? "text-[10px]" : "text-[1.85rem]"
      }`}
    >
      {name}
    </p>
  ) : null;

  if (compact) {
    const badge = home ? (
      <Link
        href={`/${tenantId}`}
        aria-label={name || "Ana sayfa"}
        className={frameClass}
        onClick={() => {
          updateSession({
            step: "landing",
            experience: undefined,
            talkCategoryId: null,
            talkIndex: 0,
            talkSurpriseSeen: false,
          });
        }}
      >
        {image}
      </Link>
    ) : (
      <div className={frameClass}>{image}</div>
    );

    if (markOnly) return badge;

    return (
      <div
        className={`flex items-center gap-3 pb-3 ${
          centered ? "justify-center" : "justify-between"
        }`}
      >
        {badge}
        {centered || !location ? null : (
          <p className="min-w-0 truncate text-[11px] tracking-wide text-muted">
            {location}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4 text-center">
      {logoUrl ? <div className={frameClass}>{image}</div> : image}
    </div>
  );
}
