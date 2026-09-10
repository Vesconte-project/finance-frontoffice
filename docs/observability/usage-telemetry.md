# Usage telemetry in Vercel Runtime Logs

How page, feature, and button usage reaches Vercel, what a log line looks like,
and how to add or read an event.

## Why runtime logs

Vercel captures `console.log`/`warn`/`error` from functions and, when a line is
a single JSON object, parses it and promotes each top-level field into a
filterable column in Runtime Logs and in any configured Log Drain.

That is the whole mechanism. It needs no vendor, no client SDK, no new
dependency, and no plan tier, which is why it was chosen over Vercel Web
Analytics custom events (Pro-plan only, and capped at two keys per event on
Pro) and over adding a third-party analytics package.

The existing best-effort forward to `finance-backend` is unchanged and still
runs. The log is now the durable record, and it is written first, so a backend
outage never costs a usage log.

## The path an event takes

```
browser interaction
  → lib/analytics.ts            queue + batch (20 events or 1.5s, flushed on pagehide)
  → POST /api/analytics/event   single envelope or { events: [...] }
  → lib/observability/vercel-log.ts
  → one JSON line per event on stdout
  → Vercel Runtime Logs / Log Drain
```

Two pieces install the browser half:

- `instrumentation-client.ts` runs after document load and **before** React
  hydration. It installs the delegated capture, so clicks are observed on every
  route, including ones that render no client component of their own. It also
  records how each navigation started and emits nothing of its own; the
  committed page view picks that value up as `p_navigation_type`
  (`initial`, `push`, `replace`, `traverse`), so a link click is not counted
  twice and a back button is distinguishable from a link.
- `components/analytics/AnalyticsProvider.tsx` is mounted once in the root
  layout. It records the committed page view on every route change and one
  event per web-vitals metric.

`AnalyticsProvider` reads the query string from `window.location` rather than
`useSearchParams`, because that hook opts the whole tree below it out of static
rendering. Mounted in the root layout, that cost would land on every page.

## What is captured without any per-component work

The delegated capture listens on `document` in the **capture** phase, so a
handler that stops propagation cannot hide a click. It matches buttons, links,
`role="button" | "tab" | "switch" | "menuitem"`, `summary`, and submit inputs,
and derives:

| Field | Source, in order of preference |
| --- | --- |
| `control` | `data-analytics-id`, `aria-label`, `aria-labelledby` target, visible text, `title`, `name`/`id` |
| `surface` | nearest `data-analytics-surface`, else nearest `section[id]`/`data-section`/`nav`/`header`/`footer`/`dialog` |
| `href`, `external` | links only |
| `pressed`, `expanded` | `aria-pressed`/`aria-checked`, `aria-expanded` |

Form submits, uncaught errors, and unhandled rejections are captured the same
way.

## Adding instrumentation

**Nothing, usually.** A new button is already counted. Reach for the following
only when the automatic capture is not enough.

1. **A stable name.** Add `data-analytics-id="ticker_export"`. Use it when the
   control's identity should survive a copy change, since the fallback label is
   whatever the button currently says.
2. **Extra payload.** Any other `data-analytics-*` attribute becomes a payload
   field: `data-analytics-ticker="AAPL"` arrives as `p_ticker`.
3. **A specific event name.** `data-analytics-event="auth_start"`. Honoured only
   if the name is in `lib/analytics-events.ts`, so a stray attribute cannot
   invent a series.
4. **Region attribution.** `data-analytics-surface="site_header"` on a wrapper.
5. **Something that is not a click** — a completed request, a stream that
   finished, a gate that rendered. Call `trackFeature`, `trackState`, or
   `trackEvent` directly.
6. **Opting out.** `data-analytics-ignore` on the element or an ancestor.
   Components that report a click themselves set this so it is not counted
   twice; `TrackedLink`, `TrackedButton`, and `RetryButton` already do.

Shared primitives take an `analyticsId` prop: `EmptyState`, `FilterChip`,
`SegmentedControl`, `RetryButton`, `PremiumPreviewCallout`.

Every event name lives in `lib/analytics-events.ts` and carries a category
(`page`, `navigation`, `interaction`, `feature`, `state`, `performance`) so logs
can be filtered to a kind of usage without knowing individual names.

## Reading the logs

In the Vercel dashboard, Runtime Logs, search or filter on:

- `vesconte.telemetry` — every usage event.
- `vesconte.server` — upstream failures, request errors, non-usage server events.
- `event` — one series, e.g. `page_view`, `export_download`, `upgrade_prompt_shown`.
- `category` — a whole kind, e.g. every `state` event.
- `route` — the parameterised route, e.g. `/stocks/[ticker]/financials/[statement]`.
- `path` — the concrete URL, e.g. `/stocks/AAPL/financials/income`.
- `sessionId` / `anonymousId` — one visit, or one browser across visits.
- `p_*` — any payload field, e.g. `p_control`, `p_ticker`, `p_surface`.

A line looks like this:

```json
{"msg":"vesconte.telemetry button_click /stocks/[ticker]","logger":"vesconte.telemetry","level":"info","event":"button_click","category":"interaction","path":"/stocks/AAPL","route":"/stocks/[ticker]","sessionId":"sess_x","anonymousId":"anon_x","occurredAt":"2026-09-10T10:00:01.000Z","loggedAt":"2026-09-10T10:00:01.400Z","env":"production","commit":"a1b2c3d","p_control":"ticker_export","p_surface":"ticker_chrome","p_ticker":"AAPL"}
```

`env`, `deploymentId`, `region`, `commit`, and `branch` come from Vercel's own
environment variables, so a usage change can be attributed to the deploy that
caused it.

## Constraints the implementation respects

- **One event, one line, flat.** Nesting is what you end up unable to filter on.
- **4KB per line.** Vercel truncates beyond it, and a truncated line stops
  parsing as JSON at all, so `serializeLogLine` sheds payload fields from the
  end until the line fits and marks the result `truncated: true`. Payloads are
  additionally capped at 24 keys and 256 characters per string.
- **Telemetry never breaks a product path.** Every entry point is wrapped, the
  ingest route answers 204 on any upstream failure, and the browser tracker
  swallows its own errors.
- **The ingress does not depend on auth.** `/api/analytics` is deliberately not
  matched by Clerk middleware: `clerkMiddleware` throws when no publishable key
  is configured, which would turn every usage event into a 500 and make
  analytics an availability risk for the thing it is measuring.
- **No new dependency.**

## Local development

Append `?analytics_debug=1` to any URL, or set `NEXT_PUBLIC_ANALYTICS_DEBUG=1`.
Every event is then mirrored to the browser console as `[analytics:event]`, and
the last 200 envelopes stay readable at `window.__vesconteAnalyticsQueue`.
`?analytics_debug=0` turns it off again.

## Known gaps

- **Viewer attribution.** Events carry `sessionId` and `anonymousId` but no
  Clerk user id, for the middleware reason above. The route already reads the
  viewer opportunistically, so attribution starts working by itself if the
  telemetry path is ever brought under middleware with a guaranteed key.
- **`components/WatchlistButton.tsx` is not instrumented.** Its accepted scope
  records "No analytics (R-6): V1 adds none", asserted by
  `tests/watchlist-signed-out-recovery.test.ts`. The control is still counted by
  the delegated capture, which reads its `aria-label` and `aria-pressed`, so
  saves and removals are visible as clicks but not as
  `watchlist_add`/`watchlist_remove` feature events. Lifting R-6 is a product
  decision, not an implementation one.
- **Server-rendered page requests** are not logged separately. Page views are
  recorded in the browser, which also covers client-side navigation. Visitors
  with JavaScript disabled are not counted.
