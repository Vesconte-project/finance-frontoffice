# Ticker request work — Part of ENG-196

No shared frontend cache is introduced. `fetchBackendResponse` still forces
no-store; all origin reads execute backend admission. BackendDataError now carries
Retry-After for the new optional chart BFF, without changing cache behavior.

## Inventory and measured counts

Re-measured 2026-10-27 against main `c5d445ba8393`, after #83/#84.
Real Next 16.2.12 production build + next start, real Chromium, existing synthetic
QAS fixtures, anonymous context. Production route/component sources are re-exported
by an isolated test shell with the real scroll provider and ticker search. Clerk,
Google Fonts and the remaining marketing shell are intentionally excluded to
allow offline testing; these are ticker-scope counts, not production RUM data.
The fixture skips duplicate Next typechecking; strict typecheck and the full
production build run on the actual project separately. Its search component
explicitly supplies the required panel variant, and the full build checks fixture
types as well. Its runtime and bundler match the installed version.

| Direct page SSR | Backend calls before | After | Inventory after |
| --- | ---: | ---: | --- |
| Overview | 7 | 5 | summary, OHLC, annual statements, profile fallback, Atlas company |
| Events | 5 | 4 | summary, events, disclosures, one monthly calendar range |
| Ownership | 4 | 4 | summary, profile fallback, capital events, history |
| Relationships | 3 | 2 | summary, Atlas company |
| Signals | 1 | 1 | shared chrome summary; page itself is currently a placeholder |
| Financials | 3 | 2 | summary, annual statements |

Metadata, ticker chrome and page reuse exactly one summary per direct render.
Events/Relationships/Financials now request only research identity, rather than
loading an unused profile. Ownership still needs profile-derived evidence. Visible
revenue and the hero OHLC remain SSR; the expanded chart's events/disclosures move
to `/api/stocks/{ticker}/chart-events`, requested only when the chart mounts.
Both chart-events and technical-series use the shared `browserRead` from #84
with the same caller-owned AbortController. The new BFF batches the two
independent calls behind one browser read; optional disclosure failure does not suppress events. Required events failure preserves
429/503 + Retry-After (or 60s fallback); errors remain private,no-store.

| Browser itinerary phase | Before | After |
| --- | ---: | ---: |
| Initial overview (including its SSR) | 7 | 5 |
| Navigate Events | 5 | 4 |
| Navigate Ownership | 4 | 4 |
| Navigate Relationships | 3 | 2 |
| Navigate Signals (layout/router reuse) | 0 | 0 |
| Navigate Financials | 3 | 2 |
| Return to overview | 7 | 5 |
| Open expanded chart | 1 | 3 |
| **Complete itinerary** | **30** | **25** |

The earlier 23 -> 20 subtotal excludes the return to overview; it is not the full
itinerary. Opening the chart moves two calls from initial SSR to deliberate use;
it does not eliminate those calls when the user really opens it. Search index
is loaded on interaction, not idle page load; no per-symbol enrichment is added.
Full raw phase/request evidence: `docs/evidence/eng196-ticker-traffic.json`.

Navigation tabs already disabled prefetch. Other ticker links now do too, and the
homepage's explicit ticker prefetch is removed. In the baseline there were five
speculative requests associated with ticker URLs (one is a sign-up redirect URL);
the candidate records zero. Those are browser RSC requests, not five extra backend
calls. Only the prefetch behavior changes on homepage; visual/motion code remains.

The overview still needs neighbour summaries for the displayed daily changes.
Only the five entries actually displayed are selected before those requests;
the unused sixth and unused related price/relation/confidence props are removed.
That upper-bound reduction is source-verified; the anonymous fixture has no real
neighbours, so it is not included in the measured reduction. Authenticated visit
counts/watchlist costs need a separately isolated session fixture or Preview.

Calendar is already one monthly request in current main, not a month-by-month
loop. Each observed request spans 28-31 days, within the backend's 63-day ceiling.
No wider unsupported calendar interval or fabricated aggregate is introduced.

## Validation and remaining evidence

`npm run verify` passed: lint (one pre-existing unused takeLast warning), strict typecheck and 341 unit/contract tests (322 + 1 + 14 + 4), zero failed/skipped and
`npm run qa:ticker-traffic` (production build, 14 measured phases, actual browser,
no runtime errors, no prefetch, request ceilings and calendar ranges). Desktop and
mobile screenshots cover the isolated shell only: missing production font/auth
chrome means they are not a full visual acceptance surface. Review the Vercel
Preview for that. Browser waits are bounded; a cache-served navigation need not
produce an HTTP response and is counted as zero origin calls where observed.

Use `scripts/qa-node-browser.Dockerfile` to provision Node browser OS dependencies;
run tests as UID 1000, --network=none, read-only rootfs/dependencies, private TMPDIR,
and an installed Chromium mounted read-only. Baseline is a tracked-file archive
of the exact fetched main commit, unpacked only inside a disposable container. It receives the same isolated fixture shell
and measurement scripts; the candidate-only chart-events fixture route is omitted
because main does not own that route. Run the harness with `--baseline` to record
baseline work without candidate-specific ceilings/zero-prefetch assertions. Both
runs retain shared-summary and calendar-contract checks. No production APIs or
credentials are used.

The expanded-chart probes run after all 14 measured phases. They confirm one
successful chart-events read, a 429 followed by one recovery request after at least
2 seconds of Retry-After, and no second request after closing during backoff.
The observed delay including jitter is recorded in the raw evidence. Extra
technical overlay work from these isolated probes is excluded from visit totals.
These are browser-client proofs; backend 429/503 metadata and optional-disclosure
behavior are separately covered by unit tests.

Integration review: the only textual merge conflict was package.json. The final
test command retains crawler, retry/deadline and stock-request tests. Automatic
merges in backend.ts, ExpandedChartDialog and StockOverviewClient retain the
#84 cancellation/no-store behavior and the #86 lazy work. Page HTTP-status
migration was deferred after the #85 proof; this PR does not rewrite that boundary.
Backend aggregation/cache improvements require explicit proposal in PR 4, keeping
admission -> cache -> response and existing tier/extraction budgets.
