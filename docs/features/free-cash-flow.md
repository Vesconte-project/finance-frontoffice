# Fundamentals — free cash flow and total reinvestment

Spec "Definições próprias das rubricas V1" (Notion, 25/11/2026), 3.2, 3.3 and
decision 1; ENG-216. Reads the annual cash flow statement of
`GET /v1/tickers/{ticker}/financial-statements` (backend #113) and the
feature-store definitions in `docs/statement-sources.md` ("SEC components and
composite definitions").

## The chapter

- **Free cash flow**, between Cash and debt and Dividends. The lead is the latest
  year's figure. Our filing definition (`sec_selection.*`) reads "left for the
  owners … after everything the business reinvested". A provider series reads
  "as <provider> publishes it" and claims nothing about what it subtracts.
- **How it is made** (our definition only): the lines in the value's
  `composition` (cash from operations, purchases of property and equipment,
  intangible assets, capitalised software), the total reinvestment and the
  free cash flow, each as the backend publishes it, with the reported sign.
  Amounts appear only when every line has the free cash flow's accession for
  the same year and currency. Otherwise only the line names are listed, so the
  parts on screen are always the parts of that figure.
- **Pay in shares** (`stock_based_compensation`, cash flow): named beside the
  figure and never taken off it. Free cash flow is cash (decision 1).
- **Where free cash flow comes from**: the shared origin disclosure, including
  years published empty (`exceeds_productive_asset_purchases`).

## Not yet

Free cash flow per share on diluted shares and pay in shares as a part of free
cash flow are ratios. The browser derives nothing, so they stay "being added"
until the feature-store publishes them.
