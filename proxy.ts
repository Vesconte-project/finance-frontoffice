import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/watchlist(.*)',
  '/api/export-signals(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!process.env.CLERK_SECRET_KEY) return
  if (isProtectedRoute(req)) await auth.protect()
})

export const config = {
  // clerkMiddleware() has to run wherever server code calls auth(), or auth()
  // throws and lib/auth.ts degrades the viewer to signed out. Ticker pages read
  // the viewer through getViewerUserId() for the watchlist control, so they are
  // matched here. Matching only establishes the auth context; protection is
  // decided by isProtectedRoute above, which deliberately excludes /stocks so
  // ticker pages stay public.
  matcher: [
    '/dashboard(.*)',
    '/stocks(.*)',
    '/api/watchlist(.*)',
    '/api/export-signals(.*)',
    // Telemetry ingress is deliberately NOT matched. clerkMiddleware throws
    // when no publishable key is configured, which would turn every usage
    // event into a 500 and make analytics an availability risk for the thing
    // it is measuring. The route reads the viewer opportunistically and logs
    // an anonymous event when auth context is absent, which it always is here.
  ],
}
