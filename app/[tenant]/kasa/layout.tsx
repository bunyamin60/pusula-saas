import type { Metadata } from "next";
import type { ReactNode } from "react";
import { tenantConfig } from "@/config/tenant.config";

export const metadata: Metadata = {
  title: tenantConfig.copy.kasa.title,
  robots: { index: false, follow: false },
};

export default function KasaLayout({ children }: { children: ReactNode }) {
  return children;
}
