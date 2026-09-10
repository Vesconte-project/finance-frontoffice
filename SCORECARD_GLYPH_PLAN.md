# Scorecard Disc Glyph — site plan (replaces the signal orbit)

## Context
We're replacing the abstract animated "signal orbit" (`components/page/SystemProfileBlob.tsx`,
shown via `OrbitMini`) with a legible **disc-scorecard**: a circular "rose" where each slice is an
investment axis tinted green→red by its score, with an **overall grade in the centre**. Goal: an
at-a-glance, *comparable* verdict (good / risky / promising), readable both large and tiny — what
the current orbit and the Simply Wall St snowflake both fail at.

Owner decisions (2026-06-22):
- Direction = **disc-scorecard** (verdict-first, breakdown-second; keeps circular identity).
- Axes = investment-decision oriented: **Value, Potential, Health, Income, Momentum**.
- Phasing **C (parallel)**: build now against the contract; each axis wires to real data as it
  lands. CORRECTION (after data-ops audit): four axes (Value/Potential/Health/Momentum) have data
  NOW; the one axis that renders **"missing"/grey until data lands is INCOME** (dividends aren't
  captured yet). Health is NOT deferred — it has data. Any axis can still be `null` per ticker
  (e.g. Health is null for ETFs with no balance sheet), so keep the null handling generic.
- Scoring lives in the **backend** (single source of truth) — see
  `finance-backend/SCORECARD_PLAN.md` for the Scorecard contract. The site **renders**, it no
  longer computes scores.

## Data
- Consume the backend **Scorecard** (`overall {score, grade, label}` + `axes[]` with
  `key/label/score|null/available`). Add a `lib/scorecard.ts` fetcher via `fetchBackendJson`
  (cached, not no-store). Build against the contract; if the endpoint isn't live, develop against
  a typed fixture.
- **Remove the frontend scoring**: `lib/signalOrbit.ts` (`buildOrbitDimensionsFromHistory`,
  `buildMiniOrbitDimensions`, telemetry) and the divergent full-vs-mini builders. Grep for all
  usages (`ScreenerSignalCard`, `WatchlistTable`, `TickerSearchCombobox`, `StockOverviewClient`)
  and switch them to consume the fetched scorecard.

## The component: `ScorecardDisc`
Replace `SystemProfileBlob` (and `OrbitMini` becomes a thin small-size wrapper as today).
Props: `scorecard` (the contract), `size`, `mini?`, `compact?`, `className`.

### Visual
- **Disc / coxcomb rose:** 5 fixed slices in axis order. Each slice is a wedge filled OUTWARD
  from the centre to a radius ∝ its score (0–100), so the silhouette still reads like a snowflake
  shape (familiar) — BUT each wedge is **tinted by its own score** green→amber→red (use a shared
  score→colour scale, same one the overall grade uses). This is the key upgrade over a mono
  snowflake: colour balance = instant verdict, shape = the story.
- **Centre = overall verdict:** the **grade letter** (e.g. "B+") large, on a disc tinted by the
  overall score colour, with the `label` word ("Solid") under it at larger sizes.
- **Reference rings:** faint concentric rings (the 0–100 scale) behind the wedges, like the
  snowflake, so you can gauge how "full" each wedge is.
- **Labels:** axis labels around the rim — large/compact only; hidden in mini.
- **Missing axis** (`available:false`/`score:null`): render the wedge as a short, grey, dashed
  stub with a faint "–" / hatch, clearly "no data yet" — never a coloured score. (In V1 that's
  **Income** until dividends land; and **Health** only for ETFs with no balance sheet.)
  The overall grade already excludes it (backend renormalizes).

### Sizes
- **Large / compact:** wedges + reference rings + rim labels + centre grade + label word.
- **Mini (~24–48px):** drop labels and rings; keep the **coloured wedges + centre grade letter**.
  At the smallest, the read is "greenish disc, B+". Must stay legible — test at ~28px.

### Motion
- **Static**, with a **subtle one-time entrance** (wedges grow from centre to their score over
  ~500ms on mount/in-view). A verdict shouldn't perpetually animate (that was the orbit's flaw).
  Respect `prefers-reduced-motion` (no grow → render final).

### Colour scale
One shared `scoreColor(score)` green→amber→red, used for wedges AND the centre grade disc, so the
whole glyph reads on one consistent scale. Keep it colour-blind-friendlier (e.g. green/amber/red
with enough lightness contrast; the grade letter also disambiguates).

## Usage sites to update
`StockOverviewClient` (hero, large), `ScreenerSignalCard` (small), `WatchlistTable` (small),
`TickerSearchCombobox` (small) — all currently build dimensions client-side; switch to passing the
fetched scorecard. Thread the scorecard from the page/data loaders.
NOTE: model pages (`ModelDetailClient`, `ModelBuilderClient`) use `profileDimensions` for MODEL
conditions — a different context. **Out of scope**; leave them as-is unless trivial to adapt.

## Graceful degradation (phasing C)
- Until the backend serves real Income, that axis arrives `null` in V1. Other axes can still be
  `null` per ticker when inputs are genuinely unavailable.
  `null` → grey "missing" wedge; the overall grade is computed by the backend over available axes.
  The site must handle any axis being `null` without breaking layout.

## Execution boundaries
- **You (site code agent):** the `ScorecardDisc` component, the `lib/scorecard.ts` client, wiring
  the usage sites, removing the old orbit scoring. No DB/server. Validate `tsc` + `npm run build` +
  browser at a `/stocks/<ticker>` (large) and screener/search (mini). Build against the contract /
  a fixture if the endpoint isn't live yet.
- **Owner:** deploys.
- **Planner (Claude):** verifies the backend scorecard via the configured `BACKEND_BASE_URL`.

## Out of scope (V1)
- Model-page glyphs.
- Re-introducing animation beyond the subtle entrance.
- Computing scores client-side (backend owns it).
