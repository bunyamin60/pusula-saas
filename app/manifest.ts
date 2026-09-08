import type { MetadataRoute } from "next";
import { tenantConfig } from "@/config/tenant.config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: tenantConfig.brand.name,
    short_name: tenantConfig.brand.wordmark,
    description: tenantConfig.brand.tagline,
    start_url: "/",
    display: "standalone",
    background_color: tenantConfig.theme.background,
    theme_color: tenantConfig.theme.primary,
    lang: "tr",
  };
}
