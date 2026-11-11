# Ticker CSV export (PRD-53)

The download control in the shared ticker header exports one ticker at a time through `GET /api/stocks/{ticker}/export`. It uses the existing server-side `getViewerAccess()` Pro check and forwards the viewer session through the existing market reader. It does not grant new backend access or use Clerk plan metadata. Invalid/missing access verification fails closed. Anonymous visitors see sign-in and pricing links; a non-Pro request receives 403 with `/pricing` as its upgrade URL.

## Datasets

- `dataset=prices`: one request to `/v1/tickers/{ticker}/ohlc`, explicitly bounded to the last 365 calendar days, at daily resolution, with no display-currency conversion. CSV columns: `symbol,date,open,high,low,close,volume,price_basis`. The backend's `price_basis=adjusted` is required: these are split/dividend-adjusted candles, not historical traded prices. Original quote units are preserved. The existing OHLC contract has no per-row currency/source metadata, so the exporter does not invent either. Weekly or paginated representations are refused.
- `dataset=fundamentals&statement=income_statement|balance_sheet|cash_flow&period=annual|quarterly`: one request to `/v1/tickers/{ticker}/financial-statements`, `latestOnly=true`, `limit=500`, `page=0`. Only the selected statement and period type are included. Columns: `symbol,statement_type,period_type,period_end,fiscal_year,fiscal_quarter,line_item_id,display_label,value,currency,known_at,source,source_updated_at,ingested_at,methodology_version,data_quality_flags`. Flags are encoded as JSON in one CSV cell. Nulls remain empty. `known_at` is the source observation date, not an official filing date. No ratios, growth, FX or other financial figures are derived.

The file includes the data available to that authenticated reader, not a promise of complete company history. No provider fetch, pagination fan-out or ingestion happens. Financial statement responses must explicitly report `truncated=false`, `latestOnly=true` and consistent row counts. Truncated results are refused rather than silently exported. An unavailable dataset returns an error; an available dataset with no rows returns 404.

## Bounds and errors

One upstream market-data request in addition to existing access verification, 15-second market-read timeout, at most 500 data rows, 2 MiB upstream JSON and 4 MiB encoded CSV. Query fields are allowlisted and duplicates are refused. The client cannot select upstream paths, arbitrary columns, windows or currencies. CSV text is escaped and formula-like text is neutralized without altering numeric negatives. Files use UTF-8 with a BOM, CRLF, an attachment filename, `private, no-store` and `nosniff`.

401/403/404/409/422/429/503 refusals remain errors; unexpected upstream failures and malformed representations return 502. Error bodies never contain raw upstream payloads. A bounded Retry-After header is retained. Download UI supports preparation, repeated attempts after failure, sign-in/upgrade recovery and cancellation on close/unmount. The display-currency control does not change exports.

## Evidence

Contract discovery: finance-backend `origin/main` at `c9e60a15c033`, contract version `2026-11-06.2`, OpenAPI `OhlcPointResponse`, `FinancialStatementsResponse`, `FinancialStatementLineItemResponse`; owning implementation `app/financial_statements.py` and `app/market_context.py`. This feature changes only the frontoffice. No schema migration, deployment configuration, credentials or infrastructure release is required.

The founder explicitly authorized proceeding without Company OS/preflight in the task conversation. That instruction overrides the task's earlier preflight stop; it does not create an AcceptanceEvent or authorize a merge/deploy.
