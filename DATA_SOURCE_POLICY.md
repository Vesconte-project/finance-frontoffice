# Data Source Policy

## Removed Legacy Search (do not reintroduce)

The site previously shipped a Yahoo-backed autocomplete at `/api/search`
(`query2.finance.yahoo.com/v1/finance/search`) with a follow-up enrichment
route at `/api/tickers/enrich` that decorated suggestions with price, quote
type, and regime data. Both were deleted (commits `2cc0333` and `dc5e563`)
and no longer exist in this repo or in production. If you see search rows
carrying price/regime/asset-type data, you are looking at a stale build or
cached bundle — not at current code. Do not recreate these routes or any
third-party symbol lookup for autocomplete.

## Canonical Runtime Sources

The frontend reads ticker data from our backend-facing routes only. Do not add browser or route-handler calls to third-party symbol lookup services.

Ticker autocomplete is intentionally narrow:

- Load `/api/tickers/index` once.
- Filter that index locally by symbol, company name, and exchange.
- Render names, exchanges, tracked/status badges, signal state, and coverage state directly from the index.
- Do not call scorecard, per-symbol, or enrichment endpoints while typing, opening, or rendering suggestions.

The ticker index must include every field the autocomplete needs. Do not add a background enrichment path to the autocomplete.

## Stock Page Data

Stock pages should use backend summary/profile/scorecard/history routes exposed through the local API and server helpers. If a field is missing, render a graceful empty state instead of adding a client-side provider lookup.

## Backend Contract Discovery and Gap Ownership

Before changing backend-dependent behavior, check accessible `finance-backend/docs/api-contract.json`, then `finance-backend/docs/openapi.json`, then the owning repository's semantic evidence. Only after that inspect this repository's local routes, helpers, types, tests, and `docs/api/` consumption/gap notes. Frontend documentation is not primary backend contract truth.

Classify missing support before proposing an endpoint:

- source missing → `finance-data-ops`
- canonical/derived semantic → `finance-feature-store`
- ML evidence → `ml-lab`
- signal intent → `finance-strategy-lab`
- realized simulated validation → `finance-backtest`
- experiment lineage → `finance-research-orchestrator`
- eligibility/activation → `finance-model-registry`
- HTTP exposure → `finance-backend`
- deployment/runtime composition → `finance-infra`
- frontend consumption/state → `finance-frontoffice`

The HTTP owner is not automatically the semantic owner. Record the owned gap and upstream evidence. Without an explicit approved decision, do not fill it through frontend derivation, third-party lookup, endpoint fan-out, approximate substitution, or a graceful state presented as complete data.

## Agent Checklist

- Do not create public free-text ticker lookup endpoints.
- Do not add autocomplete sources outside `/api/tickers/index`.
- Do not add direct-open/manual ticker suggestions that bypass the index.
- Do not add autocomplete enrichment, scorecard, or per-symbol fetches.
- Add or update tests when changing ticker autocomplete or data-source behavior.
- Verify backend contracts and classify the ownership layer before recording a gap or proposing HTTP exposure.
