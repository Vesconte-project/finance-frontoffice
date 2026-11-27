# Fundamentals — where each figure comes from

Spec "Definições próprias das rubricas V1" (Notion, 25/11/2026), section 4 and
implementation step 6; ENG-216. Consumes backend #113
(`GET /v1/tickers/{ticker}/financial-statements`: `definitionId`, `concept`,
`accession`, `composition`, `emptyReason` on each value) and the feature-store
contract `docs/statement-sources.md`.

## What the page shows

- **Revenue** and **Cash and debt** carry a "Where … comes from" disclosure under
  the chart: the provider, the SEC accession number, the reported concept (or,
  for a value our definition composes, the lines it adds from that one filing)
  and the `definitionId`. It describes the newest value with a figure.
- A year whose newest revision is empty **with** an `emptyReason` is named with
  the reason in the reader's words ("No figure for 2021: …"). It is never drawn
  as zero, never filled from an older revision, another provider or a
  neighbouring year. An empty value without a reason is simply absent.
- **Leases** (`operating_lease_liability`) are their own card beside debt, for
  the debt chart's latest year and currency, never added to debt. The sentence
  that leases are kept out of debt appears only when the debt is our filing
  definition (`sec_selection.*`), the one known to exclude them.

## Rules kept

- Nothing is derived in the browser: the disclosure repeats fields the backend
  sends. Without provenance (older payloads, fixtures) nothing is claimed.
- Share and per-share values already arrive on the issuer's current share basis
  (ENG-216, comment afebcda8); the page never re-adjusts them for splits.
- Unknown `emptyReason` codes read "the figure could not be verified".

## Components beside the lines they belong to (Financials)

- **Inside operating income** (spec 3.1): under the operating income card, the
  SEC lines `stock_based_compensation_expense`, `restructuring_charges` and
  `goodwill_impairment` for the selected year, named as "already counted in the
  figure above". The published operating income stays as reported; they are
  never added back or taken off.
- **Interest** (spec 3.4): the "Interest and income tax" card adds
  `investment_interest_income` (interest received on investments) and the cash
  flow statement's `interest_paid` (interest paid in cash, an outflow as
  reported). They are never netted against the interest expense. The Financials
  page reads the annual cash flow statement only for this line.

## Not done yet

Free cash flow and total reinvestment (3.2, 3.3) and the provider comparison
("other sites show X because they include Y") follow in later changes.
