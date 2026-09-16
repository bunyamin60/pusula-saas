import type { Metadata } from "next";
import type { ReactNode } from "react";
import { tenantConfig } from "@/config/tenant.config";

export const metadata: Metadata = {
  title: tenantConfig.copy.landing.showcase.talkTitle,
  robots: { index: false, follow: false },
};

export default function IcebreakerLayout({ children }: { children: ReactNode }) {
  return children;
}
