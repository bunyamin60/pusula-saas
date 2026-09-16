import type { Metadata } from "next";
import type { ReactNode } from "react";
import { tenantConfig } from "@/config/tenant.config";

export const metadata: Metadata = {
  title: tenantConfig.copy.landing.duelTitle,
  robots: { index: false, follow: false },
};

export default function DuelLayout({ children }: { children: ReactNode }) {
  return children;
}
