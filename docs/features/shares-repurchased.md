# Ownership & Capital — shares bought back and the share basis

Spec "Definições próprias das rubricas V1" (25/11/2026), 3.7; ENG-216 (comment
afebcda8 for the share basis). Reads the cash flow line item
`shares_repurchased` and the balance-sheet `shares_outstanding` that the
feature-store publishes from the SEC filings on the issuer's current share
basis.

- The annual Buybacks chapter shows a "Shares bought back" card beside the cash
  spent: the reported count for the same fiscal year as the cash shown, never
  another year's, and never a count inferred from the cash.
- When the shares-outstanding series is the SEC one (`sec_selection.*`), the
  Shares outstanding chapter says every year is on today's share basis. The
  page never adjusts counts for splits itself.
- The "Shares over time" card is unchanged: its bought-back row still sums the
  reported buyback executions.
