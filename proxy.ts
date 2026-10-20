import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/watchlist(.*)',
])

const sessionMiddleware = clerkMiddleware(async (auth, req) => {
  if (!process.env.CLERK_SECRET_KEY) return
  if (isProtectedRoute(req)) await auth.protect()
})

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // Credential presence only selects the verifier; it never establishes an owner.
  // Ordinary anonymous telemetry remains independent of Clerk availability.
  if (request.nextUrl.pathname === '/api/analytics/event') {
    const hasCredential = request.headers.has('authorization') || request.cookies.getAll().some(
      cookie => Boolean(cookie.value) && (cookie.name === '__session' || cookie.name.startsWith('__session_')))
    if (!hasCredential || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY)
      return NextResponse.next()
  }
  return sessionMiddleware(request, event)
}

export const config = {
  // clerkMiddleware() has to run wherever server code calls auth(), or auth()
  // throws and lib/auth.ts degrades the viewer to signed out. Ticker pages read
  // the viewer through getViewerUserId() for the watchlist control, so they are
  // matched here. Matching only establishes the auth context; protection is
  // decided by isProtectedRoute above, which deliberately excludes /stocks so
  // ticker pages stay public.
  matcher: [
    // Market readers now forward an optional verified session through the BFF.
    // These entries establish context; they do not require login on public pages.
    '/',
    '/markets(.*)',
    '/api/stocks(.*)',
    '/api/tickers(.*)',
    '/api/network(.*)',
    '/api/calendar(.*)',
    '/api/market(.*)',
    // The ticker currency list is a market read like the others.
    '/api/currencies(.*)',
    '/dashboard(.*)',
    '/stocks(.*)',
    // The calendar reads the viewer to decide how much of it is open.
    '/calendar(.*)',
    // These account-aware paid lists call auth() but keep their locked view public.
    '/picks(.*)',
    '/sitemap.xml',
    '/api/watchlist(.*)',
    '/api/ai-analyst(.*)',
    '/api/analytics/event',
    '/api/platform(.*)',
    // Telemetry stays public; only an authenticated session may forward to /v1.
  ],
}
