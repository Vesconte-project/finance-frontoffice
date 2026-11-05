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

Drafts target main directly. Rebase/retest after 4A/4B enter, preserving all optional
summary fields and regenerating backend API/route inventories. SEC historical
publication remains separate; no data cutoff or extra vendor activation is added.
Product/visual/release acceptance remains with Francisco, including human Preview.
