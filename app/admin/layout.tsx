import type { Metadata } from "next";
import type { ReactNode } from "react";
import { tenantConfig } from "@/config/tenant.config";

export const metadata: Metadata = {
  title: `${tenantConfig.copy.admin.title} · ${tenantConfig.brand.name}`,
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
