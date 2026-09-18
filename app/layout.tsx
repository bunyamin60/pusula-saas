import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { tenantConfig } from "@/config/tenant.config";
import { buildThemeCss } from "@/lib/themeCss";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${tenantConfig.brand.name} · ${tenantConfig.brand.location}`,
  description: tenantConfig.brand.tagline,
  appleWebApp: {
    capable: true,
    title: tenantConfig.brand.wordmark,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: tenantConfig.theme.background,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${sans.variable} h-full antialiased`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss() }} />
      </head>
      <body className="min-h-full bg-background font-sans text-ink">{children}</body>
    </html>
  );
}
