import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from '@clerk/nextjs'
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider'
import OptionalSessionReplay from '@/components/analytics/OptionalSessionReplay'
import SiteChromeMotion from '@/components/marketing/SiteChromeMotion'
import { ScrollRuntimeProvider } from '@/components/motion/ScrollRuntime'
import ConditionalFooter from '@/components/ConditionalFooter'
import SiteFooter from '@/components/SiteFooter'
import { clerkAppearance } from '@/lib/clerk-appearance'
import { siteOrigin } from '@/lib/site-url'
import 'lenis/dist/lenis.css'
import "./globals.css";

// Keep the existing families and weights without a Google Fonts fetch during
// the build. Source packages, unmodified font files and licences: app/fonts/.
const plexSans = localFont({
  variable: "--font-plex-sans",
  display: "swap",
  src: [
    { path: "./fonts/IBMPlexSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSans-Medium.woff2", weight: "500", style: "normal" },
  ],
});
const plexMono = localFont({
  variable: "--font-plex-mono",
  display: "swap",
  src: [
    { path: "./fonts/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: "Vesconte | Market research, signals, and context",
  description: "Explore market signals, company data, scorecards, relationships, watchlists, and AI research in Vesconte.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={clerkAppearance}>
          <ScrollRuntimeProvider defaultProfile="standard">
            <SiteChromeMotion />
            <AnalyticsProvider />
            <OptionalSessionReplay />
            {children}
            <ConditionalFooter>
              <SiteFooter />
            </ConditionalFooter>
          </ScrollRuntimeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
