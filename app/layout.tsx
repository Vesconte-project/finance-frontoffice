import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
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

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], weight: ["400", "500"] });

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
      className={`${plexSans.variable} ${plexMono.variable} ${sourceSerif.variable} h-full antialiased`}
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
