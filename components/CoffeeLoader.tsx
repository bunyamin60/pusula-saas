"use client";

import { tenantConfig } from "@/config/tenant.config";
import { isLoungeVenue, splashMessage } from "@/lib/landingCopy";
import { useCampaign } from "@/lib/useCampaign";

type CoffeeLoaderProps = {
  fading?: boolean;
};

export function CoffeeLoader({ fading = false }: CoffeeLoaderProps) {
  const campaign = useCampaign();
  const lounge = isLoungeVenue({ category: campaign.category });
  const message = splashMessage(campaign.brandName);
  const background = campaign.themeConfig.bg;
  const hookahSrc = tenantConfig.assets.hookahGif || tenantConfig.copy.splash.hookahSrc;

  return (
    <div
      className={`coffee-splash ${fading ? "coffee-splash-out" : ""}`}
      style={{ background }}
      role="status"
      aria-live="polite"
      aria-busy={!fading}
    >
      {lounge ? (
        <img
          src={hookahSrc}
          alt=""
          className="h-28 w-28 object-contain"
        />
      ) : (
        <div className="coffee-loader" aria-hidden>
          <div className="coffee-loader-vapour">
            <span />
            <span />
            <span />
          </div>
          <div className="coffee-loader-cup">
            <span className="coffee-loader-handle" />
          </div>
        </div>
      )}
      <p className="mt-6 animate-pulse text-sm tracking-wide text-muted">
        {message}
      </p>
    </div>
  );
}
