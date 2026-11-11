# Financials — reported operating-cost and interest/tax details

Part of ENG-172, original audit entries 19–20. Meaningful data consumption in the
existing Financials chapter, authorized directly by Francisco (08 November):
complete R&D/SG&A and interest/tax details from explicit already-ingested rows.
Preserve the incumbent Read interface, chapter/flow geometry, annual selector,
amount/share toggle, keyboard/touch and Being built for missing content.

## Approved execution boundary

Use the existing annual income-statement request and canonical statement IDs.
Backend contract 2026-11-06.2, GET /v1/tickers/{ticker}/financial-statements;
FinancialStatementLineItemResponse supplies periodEnd/value/currency/source.
Data-ops maps source concepts separately in providers/fundamentals.py;
feature-store financial_statements.py publishes those distinct IDs and
financial_ratios.py publishes explicitly supported annual shares/YoY. No new
endpoint, request, source/provider, credentials, schema, activation or economics.

Operating detail: research_and_development, selling_general_and_administrative,
general_and_administrative, selling_and_marketing. Interest/tax detail:
income_tax_expense, interest_expense, non_operating_interest_expense,
interest_income, net_interest_income. These can overlap and are not an exclusive
partition or reconciliation; never add/subtract or treat one as a fallback for
another. In particular, net interest income is not a financing cost inferred for
banks. Existing income-tax node and cost geometry remain unchanged.

Select exactly the revenue anchor's periodEnd and currency, preserving zeros and
signs. Never use another period with the same fiscal label, a previous year, a
ratio as an amount, or a different currency. Annual shares/YoY appear only when
already supplied, at that exact period, as currency-free fractions; an orphan
ratio without its amount cannot fill the detail. No client division, netting,
residual costs, tax/interest bridge, coverage ratio, or five-year CAGR.

All missing rows/whole details keep Being built. Populated detail controls say
View reported items; partial line items do not turn the fixed-size diagram
branches into quantitative amounts. The selected source period remains visible.
All available fiscal years remain selectable; no ten-year presentation cutoff.

## Technical and review evidence

Meaningful tests: exact period/currency alignment, zero and negative values,
missing/orphan ratios, distinct/overlapping source IDs, annual/raw-vs-derived,
unit selection and unchanged amount geometry. Browser proof through the existing
source fixture → API stub → page: both detail groups, year switch, unavailable
source, keyboard, light/dark, ten representative widths,
200% text/reduced motion. Full verify and production build before publishing;
canonical browser QA only. Fixtures prove behavior, not real provider coverage.

Human product/visual/release decisions remain Francisco's; draft PR for server
review. No merge, production data access, backfill, source call or flag changes.
The broader cost-of-sales breakdown and a complete taxes/other reconciliation
remain outside this slice; no new completeness claim.

### Local validation (08 November 2026)

- `npm run verify`: full lint/typecheck/test command passed, zero errors;
  two existing unused-variable lint warnings in unrelated files.
- Direct execution of all 64 compiled unit-test modules: **502 passed, 0 failed,
  0 skipped**; includes the six new semantic selection tests. The normal runner
  reports file-level TAP totals in this environment; direct runs expose cases.
- Production `npm run build`: passed with the existing Development Clerk setup.
- Canonical production-server Chromium QA: **28 passed, 0 failed, 0 skipped**
  across financial-statement-details, ticker-financial-inputs,
  ticker-financial-colours, ticker-display-currency and reading-system specs
  (includes one runtime setup). This is the relevant browser regression slice,
  not the full browser suite. No live-provider tests were run.
- Inspected 390/1366/1920 screenshots; tested ten widths 320–1920, keyboard,
  reduced motion and enlarged text. Initial QA found the desktop flow has no
  interest/tax child; a keyboard-accessible action in the existing income-tax
  card now opens that detail. Diagram geometry is unchanged.
- Impeccable detector's sole warning is the existing cost accent border at
  Financials.module.css:335, outside this change. No redesign undertaken.

No real-ticker coverage claims follow from these synthetic checks. Missing
source rows still show Being built. Display currency retains the existing
server-conversion/all-or-reported read contract; this change performs no FX.
