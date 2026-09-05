# Requested Backend Support

There are no active endpoint requests recorded at the creation of this document. Before adding one, inspect the machine-readable backend contract (`finance-backend/docs/api-contract.json`, then `docs/openapi.json`) and record the lookup result. Classify whether the gap belongs to source, canonical/derived semantics, ML evidence, signal intent, realized simulation, experiment lineage, eligibility/activation, HTTP exposure, deployment/runtime, or frontend consumption/state. Propose a backend endpoint only when verified upstream semantics exist and HTTP exposure is the missing ownership layer.

Use `api-request-template.md`, assign both the semantic owner and gap layer, and keep status one of `draft`, `frontend-reviewed`, `backend-reviewed`, `approved`, `implemented`, `verified`, or `declined`. A proposed route is not available to frontend code until implementation and contract verification are complete. Do not compensate with frontend derivation, third-party lookup, endpoint fan-out, or approximate substitution without explicit approval.

## Requests

| ID | Need | Consumer | Proposed endpoint | Priority | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | Batch quote and short price history for a set of symbols, so a ranking page can show price, day change and a sparkline per row | `app/(app)/picks/[reading]/page.tsx` via `lib/picks.ts` | `GET /quotes?symbols=A,B,C` returning last price, previous close and a short close series per symbol | Medium | `draft` | unassigned |
| REQ-002 | As-of-dated FX reference so non-USD listing prices can include a USD equivalent | `components/stocks/StockTickerIdentity.tsx` via `lib/stock-ticker-chrome.ts` | Deferred until source and canonical semantics exist | Normal | `draft` | `finance-data-ops` → `finance-feature-store` → `finance-backend` |
| REQ-003 | Per-ticker standing or an explicit absence reason for Long term, Income, and Short term investor readings | `app/(app)/stocks/[ticker]/page.tsx` beside the research score in `components/stocks/StockOverviewClient.tsx` | `GET /tickers/{ticker}/readings` | High | `draft` | `finance-feature-store` → `finance-backend` |
| REQ-004 | Downloadable price-series and fundamentals CSV exports alongside the existing signal-history export | `components/stocks/TickerExportButton.tsx` in `components/stocks/StockTickerChrome.tsx` | Draft local `GET /api/export-ticker?ticker=AAPL&dataset=prices\|fundamentals`; no new backend endpoint proposed | Normal | `draft` | `spy-signal-site`, with canonical fields owned by `finance-feature-store` |
| REQ-005 | A currently materialized, well-connected atlas subject for the homepage relationship map | `components/marketing/HomeNeighborhood.tsx` | Deferred until canonical subject-selection semantics exist | Normal | `draft` | `finance-feature-store` |

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
- **Dependencies and owners:** `finance-feature-store` confirms the per-symbol lookup and absence mapping over the same snapshot/universe used by rankings; `finance-backend` owns endpoint schema, authentication, errors, and contract tests; `spy-signal-site` consumes only after backend implementation and verification.
- **Compatibility/versioning:** Additive endpoint. Reading keys, position basis, universe-size basis, absence enums, and coverage units are contract fields; additions must be backward compatible, and semantic changes require an explicit version/methodology signal.
- **Approval state:** `draft`.
- **Contract evidence:** Backend evidence is the absent path plus the scorecard/rankings schemas named above. Upstream evidence is `finance-feature-store/docs/scorecard.md` and `feature_store/readings.py`. Required synthetic contract example: a ranked Long term item includes `{ position: 42, universeSize: 684, coverage: 0.94 }`, while a non-dividend Income item includes `standing: null` and `absenceReason: "pays_no_dividend"`; contract tests must also cover every absence enum and the exactly-three-items invariant.
- **Frontend fallback until available:** Render no investor reading at all—no placeholder, derived scorecard reweighting, rankings scan, endpoint fan-out, approximate standing, or empty reserved container.

### REQ-004 — Price-series and fundamentals CSV export

- **Need / user outcome:** A Pro viewer can download canonical price-series and fundamentals evidence alongside the signal-history CSV already available from `/api/export-signals`.
- **Frontend consumer:** `components/stocks/TickerExportButton.tsx` in the ready-state control rail rendered by `components/stocks/StockTickerChrome.tsx`.
- **Why existing contracts are insufficient:** `/api/export-signals` serializes signal history only. Canonical price and fundamentals data can be read as backend JSON, but the product has no approved downloadable CSV schemas, dataset boundary, filename contract, or same-origin entitlement/error surface for those exports.
- **Backend contract lookup result:** On 2026-09-05 at `finance-backend` commit `6bf5f1ec87a1a3739888be62aa4af3222981c1c0`, `docs/api-contract.json` and then `docs/openapi.json` were searched for `export`, `csv`, and `download`; no matching operation exists. Existing paths inspected were `GET /tickers/{ticker}/history` returning `PricePointResponse[]`, `/ohlc` returning `OhlcPointResponse[]`, `/profile` returning `TickerProfileResponse`, and `/financial-statements` returning `FinancialStatementsResponse`.
- **Semantic owner:** `finance-feature-store` owns the canonical price/fundamentals fields and their methodology; `spy-signal-site` owns the downloadable packaging, Clerk/Pro entitlement, and browser state.
- **Gap layer:** Frontend consumption/state in `spy-signal-site`; no source, canonical-derived semantic, or backend HTTP exposure gap is currently demonstrated.
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
- **Dependencies and owners:** Product/frontend owner approves datasets and columns; `finance-feature-store` confirms field units, freshness, and null semantics; `spy-signal-site` owns local serialization, entitlement, tests, and accessible recovery. `finance-backend` is consulted only if canonical export semantics are found missing.
- **Compatibility/versioning:** Additive local endpoint. Dataset keys, column names/order, units, filename, and error payload are versioned contract; future columns append compatibly or require a versioned dataset.
- **Approval state:** `draft`.
- **Contract evidence:** Current signal-export route tests/behavior are the access and download precedent. Backend OpenAPI schemas named above are input evidence; no price/fundamentals CSV schema or example exists yet. Approval must add synthetic CSV fixtures for both datasets plus empty, partial, malformed, unauthorized, and unentitled cases.
- **Frontend fallback until available:** Keep the control useful by exporting signal history only. Render no price/fundamentals option, disabled item, placeholder, client-side derivation, fan-out, or third-party substitute.

### REQ-005 — Homepage relationship-map subject

- **Need / user outcome:** Give the homepage relationship map a well-connected company whose atlas neighborhood is currently materialized, without maintaining a hand-picked frontend list.
- **Frontend consumer:** `components/marketing/HomeNeighborhood.tsx`.
- **Why existing contracts are insufficient:** The atlas neighborhood route answers for a caller-selected ticker, but no contract identifies a suitable current subject. A failed or sparse neighborhood therefore cannot be distinguished in advance from a useful homepage candidate.
- **Backend contract lookup result:** At `finance-backend` commit `6bf5f1ec87a1a3739888be62aa4af3222981c1c0`, `docs/api-contract.json` was checked first and `docs/openapi.json` second. Both contain `GET /network/neighborhoods/{ticker}` with caller-supplied `ticker`, `window`, `view`, `limit`, and optional `asOf`; neither contains a subject-selection endpoint, candidate field, materialization index, or well-connected-subject response.
- **Semantic owner:** `finance-feature-store`, which owns the canonical atlas materialization and must define what makes a subject suitable and current.
- **Gap layer:** Canonical-derived semantic.
- **Upstream evidence:** The existing atlas neighborhood contract and materialized graph can answer a known ticker, but no approved methodology ranks or selects homepage subjects.
- **Why HTTP exposure is the correct missing layer:** It is not yet the correct missing layer. Selection semantics do not exist upstream, so proposing transport now would invent product meaning. `finance-feature-store` must first define a canonical, currently-materialized, well-connected subject contract.
- **Proposed method and endpoint:** Deferred until the canonical selection semantics are approved; no backend endpoint is proposed by this request.
- **Minimum request fields:** To be defined after the canonical contract exists. Expected concerns include atlas window, view, and an as-of date, but their exact shape and defaults are not approved.
- **Minimum response fields:** To be defined after the canonical contract exists. It must at least identify the selected canonical symbol and the selection/materialization as-of value; eligibility, connectivity, methodology, and null semantics require owner approval.
- **Authentication/authorization:** To be defined by `finance-backend` only if HTTP exposure is later approved; browser code must continue through a same-origin server boundary.
- **Errors:** The future contract must distinguish no eligible materialized subject, stale or partial atlas data, timeout, and retryable upstream failure. Exact status codes and partial-data behavior are not yet approved.
- **Caching/pagination/rate limits:** A single daily subject is expected rather than a paginated browser list, but freshness, revalidation, and rate limits depend on the approved materialization semantics.
- **Privacy and logging constraints:** No user data is required. Do not log service credentials or unrelated request context.
- **Priority:** Normal.
- **Dependencies and owners:** `finance-feature-store` owns selection and materialization semantics; `finance-backend` would own transport only after those semantics exist; `spy-signal-site` replaces its single selection seam after implementation and contract verification.
- **Compatibility/versioning:** Any future selection methodology, universe, connectivity threshold, or rotation rule is contract meaning and must be versioned or changed compatibly.
- **Approval state:** `draft`.
- **Contract evidence:** The existing neighborhood schemas prove only caller-selected lookup. No selection schema, test, or synthetic example exists. A future contract test must cover a valid materialized subject and an explicit no-subject outcome without fabricating a fallback.
- **Frontend fallback until available:** Rotate a verified eight-symbol shortlist by UTC date, make at most two neighborhood requests through the existing cached server helper, and omit the entire section if neither produces a focus node with at least five distinct connections. Render no placeholder, estimate, empty container, third-party substitute, or wider fan-out.

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
