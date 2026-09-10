This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Development

This repository uses npm and the committed `package-lock.json`. Use the Node version in `.nvmrc` for the reproducible local setup; `package.json` records the supported minimum.

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Canonical validation

```bash
npm run verify       # lint, typecheck, and unit/contract tests
npm run qa:browser   # Playwright owns the test server and Chromium lifecycle
npm run qa:frontend  # verify, production build, and browser QA
```

Install the browser once with `npx playwright install chromium`. In CI, install its system dependencies with `npx playwright install --with-deps chromium`. Browser QA uses `http://127.0.0.1:3100` internally and does not reuse an unknown process; set `PLAYWRIGHT_BASE_URL` only to test an intentionally managed external server.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deployment TODO (Vercel)

Use this checklist when you're ready to move from local/dev to production:

1. Add production env vars in Vercel:
   - `BACKEND_BASE_URL` (or `FINANCE_BACKEND_URL`)
   - `BACKEND_SHARED_SECRET`
   - `CF_ACCESS_CLIENT_ID` (required when `BACKEND_BASE_URL` is behind Cloudflare Access)
   - `CF_ACCESS_CLIENT_SECRET` (required when `BACKEND_BASE_URL` is behind Cloudflare Access)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK`
   - `STRIPE_WEBHOOK_SECRET`
   - `SIGNAL_ALERT_CRON_TOKEN`
   - `RESEND_API_KEY`
   - `SIGNAL_ALERT_FROM_EMAIL`
2. Confirm that the separately operated `finance-backend` and data-ops deployment
   has applied the required database migrations. The SQL under `supabase/sql/`
   is not loaded or executed by this site at runtime.
3. Deploy to Vercel (`vercel --prod` or your main-branch auto-deploy flow).
4. Verify cron config from `vercel.json` is active in production.
5. Run a cron smoke test:
   - `GET /api/cron/check-signals?dryRun=1` with `Authorization: Bearer <SIGNAL_ALERT_CRON_TOKEN>`
6. Run one real delivery test on a known flip date:
   - `GET /api/cron/check-signals?date=YYYY-MM-DD`

## Backend Data Contract

The frontoffice boundary is explicit: the frontend presents and organizes data;
`finance-backend` is the only product-data source; Clerk owns authentication and
identity; Stripe owns billing and plans. Supabase may still exist behind the
separately operated backend/data-ops workflows, but this site has no Supabase
client, credentials, direct queries, or source fallback at runtime.

The site fetches screener, ticker summary, watchlist, alerts, AI research, and
analytics data through `finance-backend`.

See `DATA_SOURCE_POLICY.md` before changing ticker autocomplete, stock-page data loading, or backend proxy routes. Ticker autocomplete is index-only: it loads `/api/tickers/index` and filters locally. The old Yahoo-backed `/api/search` autocomplete and its enrichment path were removed and must not be reintroduced.

### Required runtime env vars

- `BACKEND_BASE_URL` (or `FINANCE_BACKEND_URL`)
- `BACKEND_SHARED_SECRET`
- `CF_ACCESS_CLIENT_ID` (required when `finance-backend` is behind Cloudflare Access)
- `CF_ACCESS_CLIENT_SECRET` (required when `finance-backend` is behind Cloudflare Access)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Supabase credentials belong in server-side repos (`finance-backend`, `finance-data-ops`), not in this site runtime.

### Ticker page summary semantics

Ticker pages render the canonical backend summary payload. Scorecard visibility is
determined by scorecard materialization (`hasScorecard`, materialization
readiness, and a usable overall score), not by page-component diagnostics. A
`buildReadiness: "partial"` scorecard is still a valid materialized scorecard and
must remain visible with its available axes. `componentMissingInputs` may be used
for page caveats only; it must never hide a scorecard.

Overview stat mappings are intentionally canonical: market cap is
`profile.marketCap ?? fundamentalsSummary.marketCap ?? quote.marketCapText`,
volume is `marketStats.volume`, and P/E uses only
`fundamentalsSummary.trailingPe` then `profile.trailingPe`. Do not reintroduce
fuzzy latest-fundamental row matching for P/E. The site renders the supplied
snapshot only and must not fetch or substitute later source data.

## Watchlist Tables (Dashboard)

Watchlist persistence is now served through `finance-backend` `/site/*` endpoints. The underlying tables still live in Supabase, but this site does not access them directly.

## Signal Flip Alerts (Cron + Email)

The alert pipeline sends emails when watched tickers flip signal direction on a given date.

### Setup

1. Run SQL: `supabase/sql/signal_alert_dispatches.sql`
2. Add env vars:
   - `SIGNAL_ALERT_CRON_TOKEN` (recommended, secures cron endpoint)
   - `RESEND_API_KEY`
   - `SIGNAL_ALERT_FROM_EMAIL` (must be a verified sender in Resend)
   - `NEXT_PUBLIC_APP_URL` (used in email links)

### Cron endpoint

- Route: `GET /api/cron/check-signals`
- Optional query params:
  - `date=YYYY-MM-DD` (defaults to current US/Eastern date)
  - `dryRun=1` (no email sends, useful for testing)
- Auth header (if token configured):
  - `Authorization: Bearer <SIGNAL_ALERT_CRON_TOKEN>`

The endpoint is idempotent per user/ticker/date/direction when `signal_alert_dispatches` table exists.

### Vercel Cron

`vercel.json` includes:

- `GET /api/cron/check-signals` on weekdays (`10 21 * * 1-5`, UTC)

### Cron Strategy

Call `/api/market/refresh` every 1-5 minutes for quotes and periodically (for example hourly) for historicals. This decouples user requests from provider throttling.

### Optional: Seed From Local Finance Cache

You can bootstrap Supabase from your existing local Finance repo parquet cache:

```bash
/home/franciscosantos/Finance/.venv/bin/python scripts/seed_market_cache_from_finance.py --tickers SPY
```

This is a maintenance utility for direct Supabase cache seeding. It is not part of the site runtime path.

## Multi-Ticker Signal Source (Screener/Dashboard)

Use this to power `/screener`, `/dashboard`, and signal-history/export with cross-ticker rows.

### Setup

1. Run SQL: `supabase/sql/market_signals.sql`
2. Batch upsert model outputs into `market_signals` (one row per ticker/day).
3. `latest_signals_view` will automatically expose the newest row per ticker.

### Batch Upsert Utility

Use `scripts/upsert_market_signals.py` with CSV input:

```bash
python scripts/upsert_market_signals.py --csv data/signals.csv
```

Expected CSV columns:

- `ticker`
- `signal_date` (`YYYY-MM-DD`)
- `direction` (`bullish|neutral|bearish`)
- `prob_side` (0-1 or 0-100)
- `prediction_horizon`

Optional columns:

- `source`
- `model_version_id`
- `retrain_id`
- `metadata` (JSON string)

Dry-run parser check:

```bash
python scripts/upsert_market_signals.py --csv data/signals.csv --dry-run
```

## AI Analyst Integration (Perplexity)

The existing AI route remains available for supported product surfaces. The
ticker page does not render a disabled or simulated copilot while the contextual
experience is being revisited.

### Setup

1. Add env vars:
   - `PERPLEXITY_API_KEY` (required)
   - `PERPLEXITY_MODEL` (optional, defaults to `sonar-pro`)
2. Open the supported AI surface and use its analysis action.

The app sends ticker + latest signal + recent headlines to `POST /api/ai-analyst`, which proxies Perplexity streaming output back to the client.

If `PERPLEXITY_API_KEY` is not set, the AI Analyst UI is hidden automatically.

## Usage Telemetry and Analytics Events

Page, feature, and button usage is logged as structured JSON to **Vercel Runtime
Logs**, where each field is filterable and drainable. Full reference, including
how to add an event and how to query the logs, is in
[`docs/observability/usage-telemetry.md`](docs/observability/usage-telemetry.md).

The short version:

- Every button, link, tab, and form submit is captured automatically by a
  delegated listener installed in `instrumentation-client.ts`. New controls need
  no per-component work.
- Page views and web vitals come from `components/analytics/AnalyticsProvider.tsx`,
  mounted once in the root layout.
- Events batch in the browser and post to `/api/analytics/event`, which writes one
  JSON line per event and then forwards to `finance-backend` best-effort.
- Filter the Vercel logs on `vesconte.telemetry` for usage, `vesconte.server` for
  server events, then narrow by `event`, `category`, `route`, or any `p_*` payload
  field.
- Set `NEXT_PUBLIC_ANALYTICS_DEBUG=1`, or append `?analytics_debug=1` to a URL, to
  mirror every event to the browser console.

### Backend persistence

To persist product-loop analytics used by `/api/analytics/event`, run:

1. `supabase/sql/analytics_events.sql`

The site forwards analytics events to `finance-backend`, which writes the underlying rows and stores:

- `event_name`
- `payload`
- `session_id`
- `anonymous_id`
- `pathname`
- `referrer`
- `occurred_at`

Runtime analytics smoke tests should exercise the local analytics route and its
`finance-backend` proxy. The removed Supabase client smoke script is not part of
the frontoffice workflow.

## Stripe Pro Plan Activation

The app now supports Stripe-driven Pro gating for screener full results and CSV export.

### Setup

1. Add env vars:
   - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` (Stripe Payment Link URL for your Pro plan)
   - `STRIPE_WEBHOOK_SECRET` (endpoint secret from Stripe webhook config)
   - `STRIPE_WEBHOOK_TOLERANCE_SECONDS` (optional, defaults to `300`)
2. In Stripe, configure a webhook endpoint:
   - `POST /api/webhooks/stripe`
   - Event: `checkout.session.completed`
3. Ensure checkout includes Clerk user ID:
   - Preferred: append `?client_reference_id=<clerk_user_id>` to the payment link.
   - Fallback: include `clerk_user_id` in checkout metadata.

On successful `checkout.session.completed`, the webhook sets Clerk metadata:

- `publicMetadata.plan = 'pro'`
- `privateMetadata.stripeCustomerId`
- `privateMetadata.stripeSubscriptionId`
- `privateMetadata.stripeLastCheckoutSessionId`
- `privateMetadata.stripeLastCheckoutAt`

### Local test workflow (without deploying)

Use this when you want to test Stripe end-to-end on `localhost` before pushing to Vercel.

1. Install and authenticate Stripe CLI (one-time setup):
   ```bash
   curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null
   echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
   sudo apt update
   sudo apt install stripe
   stripe login
   ```
2. Start the app:
   ```bash
   npm run dev
   ```
3. In a second terminal, start webhook forwarding:
   ```bash
   stripe listen --events checkout.session.completed --forward-to localhost:3000/api/webhooks/stripe
   ```
4. Copy the `whsec_...` shown by `stripe listen` and set it in local env:
   - `STRIPE_WEBHOOK_SECRET=<whsec_from_stripe_listen>`
5. Ensure your local payment link env exists:
   - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/...` (test-mode link)
6. Restart `npm run dev` after env changes.
7. While signed in, click Upgrade from the app and complete checkout using a Stripe test card:
   - `4242 4242 4242 4242` + any future date/CVC.
8. Verify webhook success in the `stripe listen` terminal:
   - `checkout.session.completed` forwarded with HTTP `200`.
9. Refresh the app (or sign out/sign in once) and confirm:
   - Screener lock removed for Pro user.
   - CSV export unlocked.

Important notes:

- The webhook secret from `stripe listen` is local-only and different from your Dashboard endpoint secret.
- Keep modes aligned: test payment link + test events + test account data.
- If checkout doesn’t return to your app automatically, configure Payment Link "After payment -> Redirect to URL" to your local route (for example `http://localhost:3000/screener`).

## Product Backlog

- Wire daily model batch jobs to continuously populate `market_signals` for your target universe (for example S&P 100).
- Extend the AI analyst panel with follow-up Q&A and memory per ticker.
- Add social/news momentum inputs (for example X/Reddit trend context) into AI analysis.
- Add ads/sponsored placements in the ticker News section (clear labeling, frequency caps, non-intrusive placement).
