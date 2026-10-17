# Authentication Boundaries

Authentication is integration-specific; there is no single global API policy.

| Boundary | Mechanism | Notes |
| --- | --- | --- |
| User sessions | Clerk via `@clerk/nextjs`, `proxy.ts`, `lib/auth.ts`, and handler checks | Watchlist, AI feedback, export, and plan access perform handler-level checks as applicable. Do not rely only on route matching |
| Plan authorization | Clerk public metadata read by `lib/billing.ts` | CSV export requires Pro. Stripe checkout updates Clerk metadata through the signed webhook |
| Site to `finance-backend` | `x-backend-shared-secret` from `BACKEND_SHARED_SECRET` | Server-side only; never expose in browser code |
| Cloudflare Access | `CF-Access-Client-Id` and `CF-Access-Client-Secret` | Both must be set together; server-side only |
| Alert cron | Required bearer `SIGNAL_ALERT_CRON_TOKEN` | Missing/empty configuration or invalid bearer returns 401; no refresh-token fallback. Failed backend reservation never permits email. |
| Market refresh | Existing `MARKET_REFRESH_TOKEN` behavior | Separate route; unchanged by the alert-cron correction. |
| Stripe webhook | `stripe-signature` HMAC with secret and tolerance | Verify raw body before JSON processing |
| Perplexity / Resend | Server API keys | Used only in route/server code; never return keys to clients |
| Public local routes | Ticker index/onboarding, model validation, analytics, AI analyst as currently implemented | Public does not mean unbounded or safe to enrich; preserve validation, data-source, and fail-open policies |

## Clerk middleware context

Clerk's server `auth()` only resolves on routes where `clerkMiddleware()` actually runs. Off those routes it throws, and because `lib/auth.ts` and `lib/billing.ts` catch and degrade to a null viewer, a signed-in visitor is silently rendered as signed out. The client Clerk UI is independent and keeps showing the session, so the symptom looks like a component bug rather than a routing gap.

`proxy.ts` decides two separate things, and conflating them is the trap:

- **Matched** — the path is listed in `config.matcher`, so the middleware runs and the auth context exists.
- **Protected** — the path is listed in `isProtectedRoute`, so the middleware calls `auth.protect()`.

Two rules follow. Every protected route must also be matched, because protection on an unmatched route never executes and fails open rather than closed. And a public route may be matched without being protected, which is exactly what a public page needs when it reads the viewer for personalisation: matching establishes the context, and only `isProtectedRoute` gates access. `tests/proxy-auth-context.test.ts` locks both rules without requiring Clerk credentials.

`.env.example` lists names only. Store real values in local or deployment secret stores. Never log secrets, auth headers, cookies, raw webhook signatures, Clerk tokens, or third-party payloads containing sensitive user data.
