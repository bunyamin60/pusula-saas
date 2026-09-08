import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { tenantConfig } from "@/config/tenant.config";
import { buildThemeCss } from "@/lib/themeCss";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const sans = Outfit({
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
    statusBarStyle: "default",
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
  themeColor: tenantConfig.theme.primary,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss() }} />
      </head>
      <body className="min-h-full bg-background font-sans text-ink">{children}</body>
    </html>
  );
}
