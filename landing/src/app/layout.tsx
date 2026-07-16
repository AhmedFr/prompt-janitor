import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AnalyticsClicks } from "@/components/AnalyticsClicks";
import { GA_ID, SITE_URL } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Prompt Janitor — Grade every prompt on your Mac",
  description:
    "Prompt Janitor scans every AGENTS.md and CLAUDE.md on your Mac and grades them A–F against the industry's own standards — free, forever, on your machine. Fixing them is Pro: a one-time purchase, no subscription.",
  icons: { icon: "/favicon.svg" },
  alternates: {
    canonical: "./",
    types: { "application/rss+xml": "/rss.xml" },
  },
  openGraph: { type: "website", siteName: "Prompt Janitor" },
};

export const viewport: Viewport = { themeColor: "#0a84ff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <AnalyticsClicks />
      </body>
      {process.env.NODE_ENV === "production" && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}
