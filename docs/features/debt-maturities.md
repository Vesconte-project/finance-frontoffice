# Fundamentals — when the debt falls due

Spec "Definições próprias das rubricas V1" (25/11/2026), 3.8; ENG-216. Reads the
balance-sheet line items `debt_maturity_next_12_months`, `debt_maturity_year_2`
… `debt_maturity_year_5` and `debt_maturity_after_year_5` that the feature-store
publishes from the SEC filings (`docs/statement-sources.md`).

- The Cash and debt chapter shows a "When the debt falls due" card for the
  latest fiscal year end that reports any maturity: each reported year with its
  amount, as the filing reports it, and the cash at that same year end when the
  chart has it.
- All amounts must come from one filing (accession) and one currency, or the
  card is not shown. A year the filing does not report is left out, never shown
  as zero. Nothing is added up.
- Interest cover and the room left if sales fell 30% stay "being added": they
  are ratios the backend has not published.
