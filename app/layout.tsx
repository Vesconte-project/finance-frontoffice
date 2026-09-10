import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider'
import OptionalSessionReplay from '@/components/analytics/OptionalSessionReplay'
import SiteChromeMotion from '@/components/marketing/SiteChromeMotion'
import { ScrollRuntimeProvider } from '@/components/motion/ScrollRuntime'
import ConditionalFooter from '@/components/ConditionalFooter'
import SiteFooter from '@/components/SiteFooter'
import { clerkAppearance } from '@/lib/clerk-appearance'
import 'lenis/dist/lenis.css'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
