# 5A — earnings-multiple scenarios and available history

Part of ENG-172. Founder authorized continuing the original missing-data work
while 4A/4B and SEC await server review; chose present value with an explicit,
adjustable required annual return, and maximum valid history everywhere. No
fixed ten-year data cutoff. The projection horizon is adjustable, including 30
years; supported request bounds 1–100 years are computation limits, not a claim
that those future observations exist.

Meaningful integration in the existing What the price assumes chapter, ENG-165.
Preserve chapter order, tokens, steppers, accessible fields and Being built for
unavailable data. Four explicit reader inputs: annual EPS growth, future P/E,
required annual return and years. Start blank: no invented forecast/default
return. Backend owns the deterministic model, as the existing chapter specifies.
Feature-store owns its small, native, currently eligible input bundle. Frontend
sends choices, validates response and formats values; no economic/FX calculation.

Model: current provider trailing EPS × (1+growth)^years × future P/E, discounted
by (1+required return)^years. This is the present value of a terminal share-price
scenario, with dividends excluded, not a full cash-flow valuation or a target
recommendation. Sensitivity is a backend 5×5 grid, same horizon/discount as the
selected case. Method line and comparison fractions come from the backend.

Inputs: explicit Yahoo point_in_time trailing EPS only, no annual/quarter EPS
fallback. EPS and both provider currency markers must share source clock/day,
with positive finite EPS and same-day raw close, agreeing major native currency
including listing metadata, max age seven calendar days. Unknown units/clock,
nonpositive EPS, stale prices or ADR/other unsupported canonical asset identity
leave Being built. No new registry resolver, source, schema, stage or provider call.
Only existing canonical ordinary-equity identity is eligible at the backend.

New bounded GET company-family market read, with existing IP gate, optional
verified session, invalid-JWT refusal and account budgets before validation/data.
BFF preserves auth/429 responses, validates four explicit bounded inputs and
uses existing server-side backend access. Abort/debounce/stale-request protection
clears old results on every change; no old scenario shown with new assumptions.
Native currency only; no projection of future FX or market-average assumption.

History policy: remove client 2016/5-year/10-year cuts and misleading labels on
financial/revenue/margin/multiples/capital/price surfaces. Read all valid available
pages within existing API entitlements, resolution and per-request limits. No
pagination controls/diagnostic UX. Internal traversal fails closed on malformed,
repeated, unavailable pages or bounded request/time budgets; never call a clipped
partial result the full series. Explicit selected chart zooms remain available.
The old ten-year OHLC cache key is invalidated, with All based on the completed
history read contract. No license/tier/security limits are bypassed.

Acceptance: formulas/identity/monotonicity, 30-year request, invalid/stale/foreign
input gates, actual handler+security middleware; full FS/backend suites; frontend
verify/build and canonical production-browser test for parameters, failure,
source absence and >30-year history, mobile→wide, enlarged text/reduced motion.
No live data, production DB, collection, migration, deploy or merge in this work.
Source EPS currency/share-class/split convention, current coverage and actual
query plans remain for the server to review with counts before release.

Drafts target main directly. Rebased and retested after 4A/4B entered, preserving all optional
summary fields and regenerating backend API/route inventories. SEC historical
publication remains separate; no data cutoff or extra vendor activation is added.
Product/visual/release acceptance remains with Francisco, including human Preview.

Validation refreshed 2026-11-05 against main c319306e (including newer local-font
and financial-flow work): npm run verify passed (two existing lint warnings),
production build passed, canonical browser QA 2 passed, no failures/flaky/skips.
Model inspected at 390/1366 widths; 35-year revenue inspected at the same widths.
Browser covers ten viewport widths 320–1920, reduced motion, missing inputs,
upstream refusal clearing the old grid, 30-year horizon and fiscal year 1991.
Fixtures are fictitious and prove transport/rendering, not real source coverage.
Impeccable detector reports one pre-existing financial-flow accent-border warning
at Financials.module.css:335; this PR only adds the fiscal-year selector there.

The universal history policy is maximum valid available source history. These
changes implement it for the statement/metric/capital/price consumers described
above; they do not claim every platform endpoint is already unlimited. Calendar
event/disclosure aggregation still has existing per-response count limits.
A source or tier can legitimately provide fewer years. Internal multi-page reads
are latest/non-PIT, not one transaction or a generation-pinned snapshot across
HTTP requests: repetition/overlap/refusal is detected, but concurrent source
updates can still affect ordering. Review server pagination/cost before merge.


## Rebase after deployed 4A/4B — 2026-11-06

Replayed directly onto main e34352ac7fb8fee5f1a83fb75caf3977a94ddeb1.
The summary type and fixture preserve analystConsensus and ownershipSnapshot
alongside earningsModelInputs, and the real AnalystsChapter stays wired.
Backend companion contract is 2026-11-06.2.

Full `npm run verify` passed: lint 0 errors / 2 existing warnings, strict
typecheck passed, 80 TAP test units passed / 0 failed / 0 skipped across
the five configured test runners (59 + 1 + 14 + 4 + 2).
Production `npm run build` passed. Canonical production-browser QA passed:
18 passed / 0 failed / 0 skipped / 0 flaky, including runtime, scenario,
analysts, ownership, display currency and capital inputs. The scenario
checks 30-year present value, missing inputs/refusal clearing, 35 annual
observations and the 1991 fiscal selector, 10 widths and reduced motion.
Scenario screenshots inspected at 390/1366 and revenue at 1366.

Conflicts resolved in app/(app)/stocks/[ticker]/financials/page.tsx,
components/stocks/StockFundamentalsResearch.tsx,
components/stocks/StockValuationResearch.tsx, e2e/fixtures/ticker-page.mjs,
lib/canonical-research.ts, lib/finance.ts, lib/ticker-data.ts, package.json
and tests/display-currency.test.ts. Financials keeps CurrencyNotice; revenue
keeps the rows' currency; the package runner retains every main test and adds
the scenario/history tests. Historical rows are collected before localization
so one missing conversion on a later page keeps the entire series reported.
Converted OHLC also follows all available pages instead of a ten-year window.
The prior/following-price-day refusal test in feature-store still requires
an exact UTC EPS capture day; frontend adds no price fallback or tolerance.

Local fixtures do not prove live coverage or source conventions. Remain draft
until server review. No production request, backfill, merge, flag, migration
or provider collection; no CI follow-up polling.


## Server review follow-up — 2026-11-06

Server approved the 5A design and strict date gate. Temporary request failures
now show “Couldn't load the scenario, try again” and a retry action, preserving
the assumptions and clearing the old result. Being built remains for missing
inputs. Both numeric and HTTP-date Retry-After values are honored with the
existing parser: retries stay disabled until the deadline, editing assumptions
cannot send a request early, and expiry alone causes no automatic retry loop.
Timers and pending fetches are cancelled on edits/unmount.

Removing the 11-annual-period cap and using “available history” prepares long
history; today's source has at most five annual periods, with no current memory
impact. Memory must be measured again when SEC history or ENG-264 is introduced.

Regression: e2e/earnings-scenario.spec.ts covers temporary 429 and 502, numeric
and HTTP-date Retry-After, manual recovery, editing during the pause, preserved
assumptions, and absence of Being built when current inputs exist.

Follow-up validation: full npm run verify passed (80 TAP units, 0 failed;
2 existing lint warnings), production build passed, canonical production browser
4 passed / 0 failed / 0 skipped / 0 flaky. Mechanical UI detector: no findings.

## Browser CI follow-up — 2026-11-06

The ready candidate passed verify/build but the full browser suite exposed two
old expectations missed by the earlier focused runs: expanded history still
expected no ALL option, and the QAS ten-year financial fixture still expected a
five-option fiscal-year radio group. Update those checks to the approved full
history and native select, retaining the radio path for the four-year fixture.

The neutral-colour check failed after switching from the compact layout back to
the wide layout and changing the year. All seven colour tests passed in isolated
production-browser reproduction. The check now retries the actual SVG paint,
with the same per-channel tolerance and pending-state assertion, rather than
sampling it just once immediately after the DOM attribute changes. No application
code, palette, timeouts for the whole test/suite, or fixture data changed.

Validation after this repair: full npm run verify passed (80 TAP units, no
failures; two existing lint warnings); production build passed. All seven
colour tests passed in the isolated reproduction. Canonical production-browser
coverage was completed in two local blocks with the same 10-minute global
limit and one worker: the first had 199 passes, no test failures, and hit the
global time limit before the last cases; the second had 29 passes,
23 intentional skips, zero failures/flaky tests. Combined by test ID,
all 277 cases are accounted for: **226 passed, 51 intentional skips,
0 failed, 0 unresolved**. Live/credential-dependent cases remain disabled;
no production or live-provider test was enabled. The live valuation heading
assertion is also aligned with “Multiples over time”, without running it live.
This is completed local test coverage in two blocks, not a claim that the
first full-suite command passed. The CI workflow/global limits are unchanged.
