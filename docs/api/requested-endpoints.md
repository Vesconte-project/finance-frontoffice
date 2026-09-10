# Requested Backend Support

There are no active endpoint requests recorded at the creation of this document. Before adding one, inspect the machine-readable backend contract (`finance-backend/docs/api-contract.json`, then `docs/openapi.json`) and record the lookup result. Classify whether the gap belongs to source, canonical/derived semantics, ML evidence, signal intent, realized simulation, experiment lineage, eligibility/activation, HTTP exposure, deployment/runtime, or frontend consumption/state. Propose a backend endpoint only when verified upstream semantics exist and HTTP exposure is the missing ownership layer.

Use `api-request-template.md`, assign both the semantic owner and gap layer, and keep status one of `draft`, `frontend-reviewed`, `backend-reviewed`, `approved`, `implemented`, `verified`, or `declined`. A proposed route is not available to frontend code until implementation and contract verification are complete. Do not compensate with frontend derivation, third-party lookup, endpoint fan-out, or approximate substitution without explicit approval.

## Requests

| ID | Need | Consumer | Proposed endpoint | Priority | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | Batch quote and short price history for a set of symbols, so a ranking page can show price, day change and a sparkline per row | `app/(app)/picks/[reading]/page.tsx` via `lib/picks.ts` | `GET /quotes?symbols=A,B,C` returning last price, previous close and a short close series per symbol | Medium | `draft` | unassigned |
| REQ-002 | As-of-dated FX reference so non-USD listing prices can include a USD equivalent | `components/stocks/StockTickerIdentity.tsx` via `lib/stock-ticker-chrome.ts` | Deferred until source and canonical semantics exist | Normal | `draft` | `finance-data-ops` → `finance-feature-store` → `finance-backend` |
| REQ-003 | Per-ticker standing or an explicit absence reason for Long term, Income, and Short term investor readings | `app/(app)/stocks/[ticker]/page.tsx` beside the research score in `components/stocks/StockOverviewClient.tsx` | `GET /tickers/{ticker}/readings` | High | `draft` | `finance-feature-store` → `finance-backend` |
| REQ-004 | Downloadable price-series and fundamentals CSV exports alongside the existing signal-history export | `components/stocks/TickerExportButton.tsx` in `components/stocks/StockTickerChrome.tsx` | Draft local `GET /api/export-ticker?ticker=AAPL&dataset=prices\|fundamentals`; no new backend endpoint proposed | Normal | `draft` | `finance-frontoffice`, with canonical fields owned by `finance-feature-store` |
| REQ-005 | Homepage relationship-map subject selected from the long-term board | `components/marketing/HomeNeighborhood.tsx` | None; closed by product decision in packet 10 | Normal | `declined` | `finance-frontoffice` (product selection) |
| REQ-006 | Canonical company names for atlas nodes | Homepage neighborhood and every mapped company surface | None; populate canonical names in the existing atlas contract | High | `draft` | `finance-feature-store` |
| REQ-007 | Reported margins and balance-sheet ratios as canonical metrics, so the Fundamentals view can answer profitability and solvency without the frontend dividing one line item by another | `lib/stock-fundamentals-view.ts`, rendered by `components/stocks/StockFundamentalsResearch.tsx` | Extend `GET /tickers/{ticker}/market-metrics` with `gross_margin`, `operating_margin`, `net_margin`, `return_on_equity`, `current_ratio`, `debt_to_equity`, carrying the same period semantics as the existing multiples | High | `draft` | `finance-feature-store` → `finance-backend` |
| REQ-008 | A documented line-item vocabulary for `GET /tickers/{ticker}/financial-statements` | `lib/stock-fundamentals-view.ts` | None; publish the canonical `lineItemId` set per statement type in the contract | Normal | `draft` | `finance-backend` |
| REQ-009 | Peer and sector fundamental reference values, so a reported figure can be read against something other than the company's own past | `components/stocks/StockFundamentalsResearch.tsx` | Deferred until canonical peer membership exists; blocked behind the peer/sector gap already recorded under Relationships below | High | `draft` | `finance-feature-store` |
| REQ-010 | A complete statement in `GET /tickers/{ticker}/financial-statements`. Apple returns six income line items, three balance-sheet items and one cash-flow item, against roughly forty per statement in a filing | `components/stocks/StockFinancialStatementsResearch.tsx` and `lib/stock-fundamentals-view.ts` | Extend the existing read model's line-item coverage; no new route | High | `draft` | `finance-feature-store` → `finance-backend` |
| REQ-011 | An explicit signal for a reported period the response is withholding, so the frontend can mark it as held back rather than absent | `components/stocks/StockFinancialStatementsResearch.tsx` | Add withheld-period metadata to `financial-statements`, alongside documented semantics for the existing `count` | Normal | `draft` | `finance-backend` |
| REQ-012 | Years of multiple history in `GET /tickers/{ticker}/market-metrics`, and observations for the multiples beyond trailing P/E | `components/stocks/StockValuationResearch.tsx` | Extend the market-metric read model's retention and metric coverage; no new route | High | `draft` | `finance-feature-store` → `finance-backend` |
| REQ-013 | Documented semantics for `latestOnly` on `GET /tickers/{ticker}/events`, which returns one row per `knownAt` even when set | `app/(app)/stocks/[ticker]/events/page.tsx` | Clarify or fix the flag so the calendar can be requested collapsed rather than collapsed in the frontend | Normal | `draft` | `finance-backend` |

**REQ-001 detail.** `GET /screener/rankings` returns `symbol`, `name`, `sector`, `score`,
`coverage` and `components` — no price and no series. The existing per-symbol helpers
(`getStockQuote`, `getHistoricalData` in `lib/finance.ts`) are cached individually, so
covering 25 rows means roughly 50 backend calls per render, which is why the picks pages
ship score-led without price visuals rather than fanning out. Not blocking: the pages are
useful without it. Revisit before adding sparklines or a day-change column.

### REQ-002 — As-of-dated currency conversion reference

- **Need / user outcome:** An FX rate with an explicit as-of date so a non-USD listing price can be shown with a USD equivalent for readers who do not price in the local currency.
- **Frontend consumer:** `components/stocks/StockTickerIdentity.tsx`, supplied by `lib/stock-ticker-chrome.ts`.
- **Why existing contracts are insufficient:** The ticker summary identifies the listing currency and exchange but provides no conversion rate or converted value.
- **Backend contract lookup result:** At `finance-backend` commit `6bf5f1ec87a1a3739888be62aa4af3222981c1c0`, searches of `docs/api-contract.json` followed by `docs/openapi.json` found no FX, currency-rate, or conversion endpoint or field.
- **Semantic owner:** `finance-data-ops` for source ingestion, then `finance-feature-store` for canonical/derived exposure.
- **Gap layer:** Source missing in `finance-data-ops` (no FX series is ingested) → canonical/derived exposure in `finance-feature-store` → HTTP exposure in `finance-backend`.
- **Upstream evidence:** None yet; an authoritative FX source, pair convention, valuation timestamp, market-calendar treatment, and lineage must be approved before transport is designed.
- **Why HTTP exposure is the correct missing layer:** It is not yet the only missing layer. Source and canonical semantics are absent, so an HTTP route must not be proposed as if the value already exists.
- **Proposed method and endpoint:** Deferred until upstream source and semantic contracts are approved.
- **Minimum request fields:** To be defined after the upstream contract exists; expected concerns include source currency, target currency, and as-of date.
- **Minimum response fields:** To be defined after the upstream contract exists; must include currencies, rate, as-of timestamp/date, source, and nullability semantics.
- **Authentication/authorization:** To be defined by `finance-backend` if and when HTTP exposure is approved.
- **Errors:** Must distinguish unsupported pairs, unavailable dates, stale/partial source data, upstream failure, and timeout; exact statuses are not yet approved.
- **Caching/pagination/rate limits:** To be defined from the approved series frequency and revision behavior; pagination is not expected for a single reference lookup.
- **Privacy and logging constraints:** No user data is required; avoid logging secrets or unnecessary request context.
- **Priority:** Normal.
- **Dependencies and owners:** `finance-data-ops` source ingestion, `finance-feature-store` canonical semantics, then `finance-backend` transport.
- **Compatibility/versioning:** Additive contract only; conversion semantics and timestamp basis must be versioned if they can change.
- **Approval state:** `draft`.
- **Contract evidence:** No backend schema or examples exist yet.
- **Frontend fallback until available:** Show the backend-supplied local listing currency only. Render no conversion, estimate, approximation, third-party lookup, or unavailable placeholder.

### REQ-003 — Per-ticker investor-reading standings

- **Need / user outcome:** A ticker page can say where a company stands in each of Long term, Income, and Short term, or state exactly why a reading does not apply or cannot be ranked.
- **Frontend consumer:** `app/(app)/stocks/[ticker]/page.tsx`, rendered beside the research score in `components/stocks/StockOverviewClient.tsx` only after the endpoint is implemented and verified.
- **Why existing contracts are insufficient:** `GET /tickers/{ticker}/scorecard` returns one overall grade and five axes (`value`, `potential`, `health`, `income`, and `momentum`) but no investor readings. `GET /screener/rankings?reading=…` is a top-N leaderboard, and the frontend deliberately pins it to `PICK_FULL_LIST = 25`; a ticker outside that list is absent rather than given a standing or exclusion reason. Raising the rankings limit was considered and declined because it would assign per-ticker meaning to a list-shaped contract, would leave absence ambiguous between applicability and coverage, and would still require three list scans. The Short term reading also barely touches the axes used by the other readings and cannot be derived by reweighting the scorecard.
- **Backend contract lookup result:** On 2026-09-05 at `finance-backend` commit `6bf5f1ec87a1a3739888be62aa4af3222981c1c0`, `docs/api-contract.json` was checked for `GET /screener/rankings` (`screener_rankings_screener_rankings_get`) and `GET /tickers/{ticker}/scorecard` (`ticker_scorecard_tickers__ticker__scorecard_get`). `docs/openapi.json` was then checked at those paths: rankings has required `reading`, default `limit: 25`, default `minCoverage: 0.6`, default `includeNonCompanies: false`, and an unnamed additional-properties object response; scorecard references `TickerScorecardResponse`, `TickerScorecardOverallResponse`, and `TickerScorecardAxisResponse`. No `/tickers/{ticker}/readings` path or per-ticker reading schema exists.
- **Semantic owner:** `finance-feature-store`, which defines and materializes the three readings.
- **Gap layer:** HTTP exposure in `finance-backend`.
- **Upstream evidence:** `finance-feature-store/docs/scorecard.md`, `feature_store/readings.py`, and `lib/picks-content.ts` establish three distinct reading semantics, fractional coverage, `pays_no_dividend` as a deliberate Income non-applicability reason, and hand-drawn uncalibrated score curves. The ranking order is meaningful; a raw score is not a calibrated mark out of 100.
- **Why HTTP exposure is the correct missing layer:** The canonical reading semantics and materialization already exist in `finance-feature-store`; only a bounded per-symbol transport that preserves standing and absence meaning is missing.
- **Proposed method and endpoint:** `GET /tickers/{ticker}/readings` on `finance-backend`.
- **Minimum request fields:** Required path `ticker: string`, normalized under the existing canonical-ticker rules. No reading, limit, coverage, or asset-filter query parameters; the response is always the same three-reading view so callers cannot redefine the ranked universe.
- **Minimum response fields:** `ticker: string`; `asOf: string | null` as an ISO date; `readings: array` containing exactly `longTerm`, `income`, and `shortTerm`. Each item has `reading`; `status: ranked | absent`; nullable `standing` with one-based `position: integer`, post-filter `universeSize: integer`, `coverage: number` in `[0,1]`, and optional nullable unitless `rawScore: number`; and nullable `absenceReason`. `standing` and `absenceReason` are mutually exclusive. Required absence reasons are `pays_no_dividend` (Income does not apply), `insufficient_coverage`, `ineligible_asset_type`, `not_tracked`, and `reading_not_materialized`. If `rawScore` is returned for parity or diagnosis, the frontend will not render it as a mark out of 100.
- **Authentication/authorization:** Existing canonical-ticker service authentication: product servers use `x-backend-shared-secret`; administrative consumers may use the backend service bearer token. The browser must consume it through a local server boundary.
- **Errors:** `400` invalid ticker syntax; `404` unknown ticker identity; `500` unexpected backend failure; `503` retryable reading materialization/storage unavailability. A known ticker with an inapplicable or unranked reading returns `200` with all three items and explicit per-item absence reasons, never an omitted item or ambiguous empty list. No partial response silently drops a reading.
- **Caching/pagination/rate limits:** Align freshness with the materialized reading snapshot and the existing 300-second rankings cache; return an explicit `asOf`. No pagination: exactly three bounded items. Use the canonical-ticker endpoint's normal service rate limits.
- **Privacy and logging constraints:** No user data is required. Log normalized ticker, request ID, status, and materialization/as-of diagnostics; never log shared secrets, service tokens, or unrelated request context.
- **Priority:** High.
- **Dependencies and owners:** `finance-feature-store` confirms the per-symbol lookup and absence mapping over the same snapshot/universe used by rankings; `finance-backend` owns endpoint schema, authentication, errors, and contract tests; `finance-frontoffice` consumes only after backend implementation and verification.
- **Compatibility/versioning:** Additive endpoint. Reading keys, position basis, universe-size basis, absence enums, and coverage units are contract fields; additions must be backward compatible, and semantic changes require an explicit version/methodology signal.
- **Approval state:** `draft`.
- **Contract evidence:** Backend evidence is the absent path plus the scorecard/rankings schemas named above. Upstream evidence is `finance-feature-store/docs/scorecard.md` and `feature_store/readings.py`. Required synthetic contract example: a ranked Long term item includes `{ position: 42, universeSize: 684, coverage: 0.94 }`, while a non-dividend Income item includes `standing: null` and `absenceReason: "pays_no_dividend"`; contract tests must also cover every absence enum and the exactly-three-items invariant.
- **Frontend fallback until available:** Render no investor reading at all—no placeholder, derived scorecard reweighting, rankings scan, endpoint fan-out, approximate standing, or empty reserved container.

### REQ-004 — Price-series and fundamentals CSV export

- **Need / user outcome:** A Pro viewer can download canonical price-series and fundamentals evidence alongside the signal-history CSV already available from `/api/export-signals`.
- **Frontend consumer:** `components/stocks/TickerExportButton.tsx` in the ready-state control rail rendered by `components/stocks/StockTickerChrome.tsx`.
- **Why existing contracts are insufficient:** `/api/export-signals` serializes signal history only. Canonical price and fundamentals data can be read as backend JSON, but the product has no approved downloadable CSV schemas, dataset boundary, filename contract, or same-origin entitlement/error surface for those exports.
- **Backend contract lookup result:** On 2026-09-05 at `finance-backend` commit `6bf5f1ec87a1a3739888be62aa4af3222981c1c0`, `docs/api-contract.json` and then `docs/openapi.json` were searched for `export`, `csv`, and `download`; no matching operation exists. Existing paths inspected were `GET /tickers/{ticker}/history` returning `PricePointResponse[]`, `/ohlc` returning `OhlcPointResponse[]`, `/profile` returning `TickerProfileResponse`, and `/financial-statements` returning `FinancialStatementsResponse`.
- **Semantic owner:** `finance-feature-store` owns the canonical price/fundamentals fields and their methodology; `finance-frontoffice` owns the downloadable packaging, Clerk/Pro entitlement, and browser state.
- **Gap layer:** Frontend consumption/state in `finance-frontoffice`; no source, canonical-derived semantic, or backend HTTP exposure gap is currently demonstrated.
- **Upstream evidence:** The four existing backend paths and named OpenAPI schemas above provide canonical JSON inputs. The current `app/api/export-signals/route.ts` provides the established Clerk/Pro, CSV content-disposition, no-store, and `upgradeUrl` behavior.
- **Why HTTP exposure is the correct missing layer:** New backend HTTP exposure is not presently the missing layer because the canonical datasets are already exposed to the product server. The missing surface is a same-origin frontend route that serializes an approved subset without browser-to-backend calls or third-party lookup. Escalate to `finance-backend` only if schema review proves a canonical export representation is itself required.
- **Proposed method and endpoint:** Draft local route `GET /api/export-ticker?ticker=AAPL&dataset=prices|fundamentals`; proposal only. Do not implement until the dataset boundaries and CSV schemas below receive frontend/product review.
- **Minimum request fields:** Required `ticker: string`; required `dataset: prices | fundamentals`. No client-controlled upstream path, arbitrary field list, or arbitrary history window; the server chooses the canonical bounded/full series and approved fundamentals scope.
- **Minimum response fields:** Successful response is non-empty `text/csv; charset=utf-8` with `Content-Disposition` filename and `Cache-Control: no-store`. Proposed price columns are `date`, `open`, `high`, `low`, `close`, and `volume`, preserving upstream nullability and price/volume units. Proposed fundamentals use stable long-form rows with `section`, `key`, `label`, `value`, `unit`, `currency`, `periodEnd`, `knownAt`, and `source`; exact included sections and nullable fields remain an approval dependency and must not be inferred from display copy.
- **Authentication/authorization:** Match `/api/export-signals`: Clerk user plus Pro plan. A 403 includes the billing `upgradeUrl`; backend credentials remain server-side.
- **Errors:** `400` invalid ticker/dataset; `401` authentication required; `403` Pro required plus `upgradeUrl`; `404` no rows for the selected canonical dataset; `422` approved export schema cannot represent the available dataset; `502` retryable backend failure or malformed canonical payload. Never return a successful empty file or partial file presented as complete.
- **Caching/pagination/rate limits:** Download response is `no-store`; upstream helpers may retain their documented canonical caches. No pagination in the browser-facing CSV. Define a maximum row/file size and timeout during approval, with a clear 422/502 outcome rather than truncation without metadata.
- **Privacy and logging constraints:** No user-entered content beyond ticker/dataset. Log user ID only as required for entitlement/audit, plus normalized ticker, dataset, row count, and outcome; never log CSV contents, financial-provider payloads, Clerk tokens, billing URLs, or backend secrets.
- **Priority:** Normal.
- **Dependencies and owners:** Product/frontend owner approves datasets and columns; `finance-feature-store` confirms field units, freshness, and null semantics; `finance-frontoffice` owns local serialization, entitlement, tests, and accessible recovery. `finance-backend` is consulted only if canonical export semantics are found missing.
- **Compatibility/versioning:** Additive local endpoint. Dataset keys, column names/order, units, filename, and error payload are versioned contract; future columns append compatibly or require a versioned dataset.
- **Approval state:** `draft`.
- **Contract evidence:** Current signal-export route tests/behavior are the access and download precedent. Backend OpenAPI schemas named above are input evidence; no price/fundamentals CSV schema or example exists yet. Approval must add synthetic CSV fixtures for both datasets plus empty, partial, malformed, unauthorized, and unentitled cases.
- **Frontend fallback until available:** Keep the control useful by exporting signal history only. Render no price/fundamentals option, disabled item, placeholder, client-side derivation, fan-out, or third-party substitute.

### REQ-005 — Homepage relationship-map subject — closed by product

- **Approval state:** `declined` — backend request closed by the product owner's packet 10 decision (2026-09-05), not by new backend support.
- **Resolution:** The first long-term board symbol is the subject. If its atlas neighborhood is unusable, try the next visible name in order, through the column's five. If none is usable, omit the section. The curated daily shortlist and its selector are removed.
- **Frontend consumer / owner:** `components/marketing/HomeNeighborhood.tsx`, `finance-frontoffice`. The board's existing entitlement gate supplies the candidate items; there is no independent universe lookup.
- **Contract evidence:** At `finance-backend` commit `6bf5f1ec87a1a3739888be62aa4af3222981c1c0`, `docs/api-contract.json` then `docs/openapi.json` expose caller-selected `GET /network/neighborhoods/{ticker}` with `window`, `view`, `limit`, and optional `asOf`. This existing route is sufficient for the approved selection rule.
- **Backend work / gap layer:** None remains for subject selection. `finance-feature-store` still owns atlas materialization, but this closed request no longer asks it to choose a homepage subject. No new endpoint, field, authentication, response shape, or selection methodology is proposed.
- **Consumption:** Existing server helper and hourly per-symbol/day cache remain. A usable answer must match the requested focus and retain the existing focus node plus five distinct connections requirement. At most five sequential candidates; no external lookup, placeholder, or empty frame.

### REQ-006 — Atlas nodes carry the symbol where a company name should be

- **Need / user outcome:** Populate a canonical company name for every symbol the atlas can return, so a mapped company can be identified by someone who does not already recognize its ticker.
- **Frontend consumer:** `components/marketing/HomeNeighborhood.tsx`; applies to every mapped company surface.
- **Why existing contracts are insufficient:** `AtlasNodeResponse.name` is a required string, so a symbol is returned in place of a missing name rather than null. The consuming surface cannot distinguish "no name available" from "the name is the symbol", and omits the secondary text either way. Observed in preview review on 2026-09-05: the neighborhood showed no distinct company name for `AMZN`, `AFRM` or `SHOP`, while `SNAP` and `TSLA` had one.
- **Scope correction, 2026-09-06:** an earlier version of this record also claimed `PickItem.name` was null for leading ranked symbols and listed `VOR`, `PRTH`, `IRWD` and others as evidence. That was wrong. The board renders those names correctly; the original observation was taken from a viewport below 1280px, where the name column is deliberately hidden. The ranking half of this gap does not exist and has been removed.
- **Backend contract lookup result:** At `finance-backend` commit `6bf5f1ec87a1a3739888be62aa4af3222981c1c0`, checked `docs/api-contract.json` then `docs/openapi.json`. The neighborhood endpoint already exposes a name; no endpoint is missing. `AtlasNodeResponse.name` is a required string, so a missing canonical name is replaced by the symbol rather than represented as null.
- **Semantic owner:** `finance-feature-store`.
- **Gap layer:** Canonical-derived semantic.
- **Upstream evidence:** Atlas serialization returns `str(name or symbol)` (`app/relationship_atlas.py`), which satisfies the required-string schema without supplying a company name. Frontend `AtlasNode.name` is therefore always populated, and symbol-equal names are omitted from the neighborhood's secondary text.
- **Why HTTP exposure is the correct missing layer:** It is not. Transport and name fields exist; canonical population is incomplete.
- **Proposed method and endpoint:** None. Populate canonical company names behind the existing atlas contract.
- **Minimum request fields:** Existing request fields remain unchanged.
- **Minimum response fields:** A populated canonical company name for every returned symbol. No new field or response shape is proposed.
- **Authentication/authorization:** Existing server-side backend authentication and ranking entitlement gate remain unchanged.
- **Errors:** Missing names must not cause nodes to disappear from a map or become substitute/estimated values. Existing unavailable, partial, and upstream-error behavior remains.
- **Caching/pagination/rate limits:** Existing contracts and caches remain unchanged; canonical population must propagate through normal refreshes.
- **Privacy and logging constraints:** Public company identity only; no credentials or user data in evidence.
- **Priority:** High.
- **Dependencies and owners:** `finance-feature-store` owns canonical name coverage; `finance-data-ops` owns any missing underlying identity source; `finance-backend` transports the existing field; `finance-frontoffice` consumes without lookup or enrichment.
- **Compatibility/versioning:** Populate the existing field compatibly; retain canonical symbols.
- **Approval state:** `draft`.
- **Contract evidence:** Existing `GET /network/neighborhoods/{ticker}`, `AtlasNodeResponse`, and the atlas serializer. Closure requires a distinct company name for every symbol the atlas can return.
- **Frontend fallback until available:** Render the symbol alone when no distinct name exists. Do not reserve missing-name width in the neighborhood list, render a placeholder, or fetch names elsewhere.

## Confirmed Phase 2 contract gaps

These are frontend-observed data requirements. Implemented portions are recorded explicitly; unresolved fields remain gaps and must not be inferred.

### Complete company and fund profile

- Stable asset kind and field applicability for equity, ETF, fund, and other supported instruments.
- Business/fund description, activity or objective, sector/category, industry, country/domicile, exchange, website, head office, employees, foundation/inception, issuer, structure, and identifiers.
- Explicit source, as-of/freshness, null semantics, and coverage/readiness.
- Confirmed error semantics for unavailable, unsupported, partial, malformed, and unauthorized responses.

The existing `/tickers/:ticker/profile` normalizer remains the only current source. No additional route is assumed.

### Financial statement series

Status: partially implemented through `GET /tickers/:ticker/financial-statements`.

- Statement type: Income Statement, Balance Sheet, or Cash Flow.
- Frequency: Annual or Quarterly.
- Ordered line items with stable keys, labels, values, period end, filing date, currency, unit, and scaling.
- Comparative periods and period-over-period growth where canonically supplied.
- Restatement/version metadata and source context.
- Explicit partial/empty/unsupported semantics and available history window.

The shared ticker contract supplies canonical line items, annual/quarterly periods, period end, currency, source, `knownAt`, methodology and quality flags. Filing date, backend-supplied ordering/hierarchy, scaling, comparative growth and explicit restatement relationships remain gaps. The frontend does not substitute summary fundamentals for missing statement rows.

### Valuation history

Status: partially implemented through `GET /tickers/:ticker/market-metrics`.

The Valuation History view now displays direct temporal observations for supported canonical metric keys, preserving observation date, `knownAt`, source and methodology. Current summary fields remain a narrow fallback for current P/E context only. The following contract gaps remain:

- Metric series for P/E, P/S, P/B, P/FCF, EV/EBITDA, and future supported multiples.
- Explicit frequency and period semantics for annual and quarterly observations.
- Ordered observations with metric key, period end, value, unit, currency, source, as-of timestamp, and restatement/version metadata.
- Canonical historical range statistics such as minimum, maximum, mean/median, and current position or percentile, with methodology defined by the backend.
- Peer and sector benchmark observations with stable identities, comparison period, membership/as-of rules, and aggregation method.
- Event or market-period markers that can be associated with valuation observations.

The frontend must not derive unsupported multiples, historical ranges, percentiles, peer medians, or sector comparisons from current summary fields or price history.

### Ownership and capital structure

The Ownership & Capital view currently uses only market cap, shares outstanding, currency, and reporting period when those fields are present. The following asset-aware contract is required for live ownership and capital modules:

- Ownership categories with percentages, share counts, as-of dates, source, and explicit null/coverage semantics.
- Top holders with stable identifiers, holder type, position, percentage, date, and ranking methodology.
- Free float, closely held shares, share classes, and voting/non-voting semantics.
- Debt, cash and equivalents, minority interest, and enterprise value with consistent currency, unit, period, and source metadata.
- Shares-outstanding history with ordered observations and period semantics.
- Issuance, buyback, split, and other capital-action history with dated events and share-count impact.
- Fund-specific fields for issuer, AUM, shares outstanding, creation/redemption structure, holder concentration, and fund-level applicability.

The frontend must not infer institutional, insider, retail, or free-float percentages, calculate enterprise value, or classify corporate dilution from the current summary/profile payload.

### Signals and technical evidence

The Signals & Indicators view uses existing `/signals/history/:ticker`, `/screener/signals`, and `/tickers/:ticker/ohlc` helpers. The following future contract gaps remain before deeper history can be shown as canonical evidence:

- Signal history rows with stable identity, direction, date, reported horizon, source, as-of timestamp, and explicit duplicate/error semantics.
- Canonical regime history with state vocabulary, start/end timestamps, duration semantics, coverage, and methodology.
- Indicator series by canonical indicator key, family, period, frequency, value, unit, source, as-of timestamp, and missing-data semantics.
- Explicit chart-range versus signal-horizon semantics; UI ranges must not be treated as model horizons.
- Technical aggregation methodology and versioned source timestamps for Summary, Oscillators, and Moving Averages.
- Volume, turnover, spread, and liquidity fields with frequency, currency/unit, and coverage semantics.

The frontend currently uses the existing OHLC-derived technical implementation for the same Summary, Oscillators, and Moving Averages already used by Overview. It does not create a historical indicator series or recalculate signal scores.

### Earnings and events

Status: partially implemented through `GET /tickers/:ticker/events` and `GET /tickers/:ticker/disclosures`.

The shared ticker-scoped surfaces provide canonical event identity, domain/type, date role, date, source, `knownAt`, candidate classification/confidence and disclosure links. The summary still supplies the richer next-earnings facts. The following richer product fields remain gaps:

- Stable event identity, type, date, time, timezone, fiscal/reporting period, source, certainty, as-of timestamp, and coverage state.
- Earnings actuals, estimates, surprise fields, guidance, revisions, restatements, and duplicate/version rules.
- Dividend and distribution events with declaration, record, ex-date, payment/distribution date, amount, currency, and source.
- Corporate actions including splits, issuance, buybacks, shareholder meetings, and filings with effective dates and asset applicability.
- Fund-specific distributions, rebalances, index changes, issuer events, splits, and structural changes.
- Optional event-to-price relationships with an approved methodology; the frontend must not infer event impact.

The page renders the canonical calendar/disclosure stream and preserves candidate semantics. Rich earnings actuals/estimates, action amounts, event detail fields and any event-to-price relationship need separate approved product contracts; the frontend does not derive them.

## Phase 3 Relationships contract gaps

The current reduced-scope Relationships view consumes only the existing `/relationships/:ticker` payload. The following fields are still future backend contracts and must not be inferred in the frontend:

### Canonical relationship semantics

- Stable relationship identity, source and target identity, category/layer, and asset applicability.
- Definition, scale, sign, and null semantics for `strength`.
- Canonical methodology, coverage meaning, and null semantics for `confidence`, beyond the frontend's existing 0–1/percentage normalization convention.
- Explicit direction semantics for directional relationships. Direction must not be treated as causality.
- Dataset and edge-level `asOf`, source timestamps, observed start/end, frequency, session, timezone, and currency/market compatibility.
- Methodology identifier/version and source metadata.

### Historical and directional evidence

- Historical or rolling correlation series with period and frequency semantics.
- Lead/lag interval, method, direction, statistical support, and non-causal interpretation.
- Relationship persistence or structural classification with a defined observation window.
- Canonical recent-relationship semantics rather than relying only on numeric windows.

### Entity and market relationships

- Canonical peers, sector, and industry membership with source and effective dates.
- Index and ETF membership, weights, and membership snapshots.
- Market sensitivity/beta and macro exposures for rates, currencies, commodities, and market factors.
- Supplier, customer, competitor, value-chain, and geographic relationships with evidence and source.

### Fund relationships

- Holdings overlap, issuer, index tracked, AUM, constituent comparison, fund-level factors, creation/redemption data, and fund relationship methodology.

Until these contracts are defined and verified by finance-backend owners, the frontend must keep these areas deferred. It must not label co-movement as influence, derive peers from prices, infer structural relationships, or fabricate strength/confidence values.


### REQ-007 — Margins and ratios are the missing half of Fundamentals

The Fundamentals view asks four questions about the business: is it growing, does it
earn on what it sells, can it carry itself, does it pay its holders. Two of those are
ratio questions, and `GET /tickers/{ticker}/financial-statements` returns levels only.

The arithmetic is trivial — operating margin is operating income over revenue, both of
them line items of the same statement and period — and that is exactly why it is not
done here. A margin published by the frontend has no methodology version, no data
quality flags, and no agreement about which revenue line it divides by; two surfaces
computing it slightly differently is the failure this repository's rule against
derivation exists to prevent.

Until this lands, `Profitability` and `Financial health` show reported levels with
their full history — gross profit, operating income, EBITDA; cash, total debt, equity —
which answers the direction of both questions without answering their intensity.

### REQ-008 — The line-item vocabulary is undocumented

`FinancialStatementLineItem.lineItemId` is the join key the Fundamentals view curates
against, and no published list of its values exists. The view names the spellings this
contract is known to use and anchors each match, so an unmatched name yields no card
rather than the wrong one, and a chapter that matches nothing falls back to its
statement's own row order. That fallback is a safety net, not a design.

### REQ-009 — Without peers, a company can only be read against itself

The first question a reader has about a reported figure is whether it is high, and the
only reference point this frontend can honestly supply today is the company's own
history. That is why every measure on the Fundamentals view carries its full series
rather than a single current value: the series is standing in for the comparison we
cannot make. Peer and sector membership is already recorded as missing under
Relationships; this records the fundamentals-side consumer of it.


### REQ-010 — The statements are outlines, not statements

Verified against Apple on 2026-09-07, reading the `lineItemId` values the
Financials view was printing at the time:

- Income statement: `revenue`, `gross_profit`, `operating_income`, `ebitda`,
  `net_income`, `eps` — six rows, three annual periods.
- Balance sheet: `total_assets`, `total_liabilities`, `shares_outstanding` —
  three rows, four annual periods.
- Cash flow: `free_cash_flow` — one row.

What is absent shapes two views. There is no cost of revenue, no operating
expense and no tax line, so the income statement cannot be read as a
statement — only as six results of one. There is no cash, no debt and no
equity, so `Financial health` on the Fundamentals view answers with total
assets and total liabilities, which describe size rather than solvency; the
margins and ratios recorded under REQ-007 would need these same rows to be
computed anywhere at all. And with one cash-flow row there is no operating
cash flow to set free cash flow against, which is the comparison that says
whether the free cash flow was earned or released.

The annual history is also short — three to four periods where a filing set
carries ten. Until it lengthens, the change columns on the Fundamentals view
have two or three entries.

The quarterly series is shorter still: the income statement returns three
quarters, which cannot cover a year, so the quarterly view cannot show a full
trailing four and no seasonal comparison is possible against the same quarter a
year earlier. Four is the minimum that makes the quarterly toggle worth
offering; eight would let a quarter be read against its own prior year.

### REQ-011 — Absent and withheld are not the same thing

The product intends earlier history to become a paid tier. A frontend cannot
mark a period as locked unless the response says a period exists and is being
withheld — drawing a padlock over history the backend simply does not hold
would be inventing a paywall over missing data, and would tell a reader we have
something we do not.

`CanonicalAvailability.count` is not that signal, and its semantics are
undocumented: the income statement reports 500 for a symbol whose rows number
in the tens, which is the value this frontend sends as `limit`, while the
balance sheet reports 492 and the cash flow 206. Whatever it counts, it is not
"periods available to you", so nothing is rendered from it.

Wanted: per-period entitlement state on the response — reported, withheld,
never filed — and documented `count` semantics. The statement view will mark
withheld periods when the contract can distinguish them.


### REQ-012 — A valuation history that is not a valuation history

Verified against Apple on 2026-09-07: `trailing_pe` returned 41 daily
observations spanning 29 June to 4 September 2026 — about ten weeks. The other
four multiples the view asks for (`price_to_sales`, `price_to_book`,
`price_to_free_cash_flow`, `enterprise_value_to_ebitda`) returned nothing.

Ten weeks cannot answer the only question a valuation page exists for. A P/E of
37.68x is high or low against the range this company has traded in over years,
and against its peers; the peer half is already recorded as REQ-009, and this
records the other half. Over a single summer the observed range is 33.54x to
41.79x, which is a fact about one quarter and reads as a dramatic line only
because the axis is that narrow.

The frontend is not truncating this. `getTickerMarketMetrics` sends
`limit: 250` and 41 rows come back, and the helper sends no date range at all.
Whether the endpoint accepts one — `/events` does — is unverified from this
repository; if it does, part of this may be a request we are not making rather
than history the backend does not hold, and that is the first thing to check
when this is picked up.

Wanted: multi-year retention on the observation series, and observations for
the remaining multiples. Until then the view lists all five multiples and says
plainly which are not covered yet, rather than dropping four of them without
account or offering a tab that leads to an empty frame.


### REQ-013 — `latestOnly` does not appear to mean latest

The events calendar is requested with `latestOnly: true` and still returns one
row per `knownAt`: Apple's next earnings date came back twenty-five times,
identical except for the day each observation was recorded, and the page was
rendering each as its own event.

The frontend now collapses them by event identity and keeps the newest
observation, which is correct behaviour to have regardless. But it is doing
work the flag reads as though it should already do, and the count the response
reports is a count of observations rather than of events — the coverage panel
was reporting "25 canonical events" for one earnings date.

Wanted: documented semantics for `latestOnly`, and a count that counts events.
Bitemporal history is worth keeping in the contract — a date that moved is real
news, and the view surfaces exactly that — but it should be opt-in rather than
the default shape of a calendar.
