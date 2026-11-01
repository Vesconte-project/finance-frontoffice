# Adjusted chart contract

Part of ENG-172. Companion to finance-backend #65 and finance-feature-store #54.

Historical lines/candles retain `price_basis: adjusted`; rows with missing/raw
basis or invalid prices refuse the company payload. No raw history is relabelled.
The OHLC identity advances from stock-ohlc-cache-v2 to stock-ohlc-cache-adjusted-v3.
Full-history requests add the adjusted-v3 query identity and use no-store, so an
old browser/CDN raw response cannot silently supply an adjusted chart. Related
local history responses are private/no-store. Request-local React cache remains.

Hero and expanded charts say **ajustado a splits e dividendos**. Quote, last real
price and the day's change continue to come from the raw quote fields; the chart
is not used to calculate the displayed real day move. Historical measurements
and event-relative returns deliberately use the chart's adjusted series.

Expanded-chart indicators read the existing backend technical-series contract
through a local authenticated-context backend proxy. SMA 20/50/200, Bollinger
bands and RSI are drawn only when the response is ready, the top/series basis is
adjusted and every candle is adjusted. The same guard runs at the canvas draw
boundary. Stale, unavailable, invalid or unknown-basis overlays draw nothing and
the control reports the unavailable state. Nothing is calculated as an indicator
fallback in the chart. Null warm-up points break lines. RSI has its own 0–100 pane.
Raw quote/day-change paths and historical volume are not adjusted by this PR.
The pre-existing client technical summary continues to read the same now-adjusted
OHLC; this change does not introduce a second source/provider.

Backend 409 adjusted_price_input_invalid remains unavailable to the chart.
The server guard in #65 also suppresses stale overlays during the initial history
backfill; frontend readiness alone does not certify a historical rebuild.

Rollout: Francisco reviews/deploys this frontoffice change in coordination with
backend #65 followed immediately by feature-store #54. The strict new frontend
can show an unavailable chart until the backend supplies adjusted metadata.
Changing code does not repair previously calculated features. Complete today's
full-history backfill and 104-week Atlas replacement according to #54's runbook.

Validation: full production TypeScript typecheck, focused ESLint and 20 synthetic
unit/contract tests. Runtime base python:3.12, non-root, network none, read-only
sources/root and private TMPDIR 0700; Node 22 and exact lockfile dependencies
prepared separately and mounted read-only. Tests cover raw/absent basis refusal,
cache version, malformed/mixed company payloads, readiness/matching-basis gates,
raw quote code path and existing OHLC/expanded-chart math.

Not yet proved: browser rendering, pointer/keyboard layout at the RSI pane,
responsive/reduced-motion checks, authenticated proxy/real runtime integration,
and Francisco's visual review. No production data, credentials, merge or deploy
was used for this draft. CI owns the remaining complete frontend regression suite.


CI fixture correction: the synthetic browser backend now explicitly publishes
adjusted history/OHLC and raw quote metadata. It also models a stale technical
response, rather than returning an unmodelled HTTP error for the new consumer.
A fast contract test feeds all three fixture tickers through the production
normalizers before browser QA. Missing/raw basis continues to be refused.
Browser regressions cover ready adjusted RSI rendering and a ready response whose
series basis is wrong; the existing stale/unavailable flow stays covered. The
ready-RSI state is captured when the owned harness enables PLAYWRIGHT_CAPTURE.
