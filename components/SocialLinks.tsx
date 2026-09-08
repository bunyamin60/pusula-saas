"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Star } from "lucide-react";
import { tenantConfig } from "@/config/tenant.config";
import { useCampaign } from "@/lib/useCampaign";

type SocialLinksProps = {
  variant: "landing" | "reward" | "claimed";
};

export function SocialLinks({ variant }: SocialLinksProps) {
  const campaign = useCampaign();
  const landing = tenantConfig.copy.landing;
  const reward = tenantConfig.copy.reward;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const instagram = campaign.instagramUrl;
  const google =
    campaign.googleReviewUrl || tenantConfig.reward.googleReviewUrl;

  if (variant === "claimed") {
    return (
      <div className="space-y-3">
        <a
          href={google || tenantConfig.reward.googleReviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="google-rate-card flex w-full flex-col items-center justify-center gap-2"
        >
          <span className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className="size-5 fill-amber-400 text-amber-400"
              />
            ))}
          </span>
          {reward.googleCta}
        </a>
        {instagram ? (
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex w-full items-center justify-center gap-2"
          >
            <InstagramIcon className="size-4" />
            {reward.followCta}
          </a>
        ) : null}
      </div>
    );
  }

  if (!ready || (!instagram && !google)) return null;

  if (variant === "landing") {
    return (
      <div className="space-y-2">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {landing.socialHint}
        </p>
        <div className={`grid gap-2 ${instagram && google ? "grid-cols-2" : ""}`}>
          {instagram ? (
            <SocialAnchor href={instagram}>
              <InstagramIcon className="size-4 text-primary" />
              {landing.instagram}
            </SocialAnchor>
          ) : null}
          {google ? (
            <SocialAnchor href={google}>
              <Star className="size-4 fill-primary text-primary" />
              {landing.google}
            </SocialAnchor>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === "reward") {
    if (!instagram) return null;
    return (
      <SocialAnchor href={instagram} className="relative mt-4 min-h-12 text-sm">
        <InstagramIcon className="size-4 text-primary" />
        {reward.instagramCta}
      </SocialAnchor>
    );
  }

  return null;
}

function SocialAnchor({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-ink transition-colors hover:bg-primary/10 ${className}`}
    >
      {children}
    </a>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
