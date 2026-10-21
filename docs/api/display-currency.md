# Display currency and listings we track on the ticker pages (consumption notes)

Primary contract: finance-backend README "Display Currency Contract" (`app/fx.py`,
`app/ticker_money.py`) and the summary's `listings` block (`app/entity_resolver.py`).
These notes describe how the frontoffice consumes them; they are not contract truth.

## What the backend gives

- `GET /v1/currencies` → `{available, reason, pivot: "USD", maxStalenessBusinessDays, currencies: [{code, latestRateDate, status}]}`.
  USD comes first. Without the FX tables the list is USD alone with `available: false`.
- `?currency=XXX` on the ticker reads. Without it every response is unchanged. With it,
  every original amount stays in place and each object holding amounts gains
  `money: {<field>: {value, currency, sourceCurrency, date, converted: {value, currency, rate, rateDate} | null, unconvertedReason}}`,
  each amount at the rate of its own date. An unlisted code is 422 `unsupported_currency`.
- `GET /v1/tickers/{ticker}/summary` carries a top-level `listings` block, unaffected by
  `?currency=`: `{available, reason, items: [{symbol, exchange, exchangeMic, country, currency, isPrimary, isCurrent}]}`,
  primary first, then by symbol. `exchange`, `exchangeMic`, `country` and `currency` may be
  null; an unavailable block (`symbol_absent`, `provisional_only`, `entity_tables_absent`, …)
  has no items.

## Product rules (founder, 2026-10-20)

- The display currency lives only in the URL (`?currency=XXX`). No browser storage and no
  account preference. Without it, or with the listing's own currency, nothing is converted.
- The page stays in the listing's currency. A display currency adds:
  - the header price's conversion beside the reported one ("₩75,000 ≈ $54.11"), from the
    backend's conversion of the latest price;
  - an explicit "Show in {CCY}" toggle under the Overview price chart. When on, the chart
    draws each day's backend value, and a decomposition of the visible range follows:
    the company's return in its listing currency, the currency effect
    ((1 + r_ccy) / (1 + r_local) − 1) and the return in the display currency, all from
    the same first and last days with a conversion. Days without one are left out of the
    line and counted; nothing is filled in.
- Technical indicators, signals, scorecards, financial statements and every other figure
  on the ticker tabs stay in the listing's currency.
- The header control ("Listings and currency") opens a dialog: "Listings we track" (each
  other listing links to its own page, the current one is marked, the primary one badged),
  then the display currencies `/v1/currencies` lists. The copy says a converted price is
  not a listing traded in that currency. An unavailable block says so; an absent block
  (older backend) hides the section.

## How the site uses it

| Piece | Where |
| --- | --- |
| Local route for the list | `GET /api/currencies` (`app/api/currencies/route.ts`) |
| Header conversion (the layout does not see `?currency=`) | `GET /api/stocks/{ticker}/quote?currency=XXX` → `{ticker, currency, converted: {value, currency, rateDate} \| null, unconvertedReason}` |
| Chart in a currency | `GET /api/stocks/{ticker}/history?currency=XXX` → `[{date, close, converted \| null}]` (422 for an unlisted code) |
| Listings | `summary.listings`, read by `lib/stock-ticker-chrome.ts` with `parseTrackedListings` |
| Server reads | `lib/display-currency-server.ts` (`resolveDisplayCurrency`, `fetchInDisplayCurrency`), used by `lib/ticker-data.ts` and `lib/finance.ts` (`getConvertedCloses`) |
| Parsing and the decomposition | `lib/display-currency.ts` (pure, unit-tested in `tests/display-currency.test.ts`) |
| Control and dialog | `components/stocks/DisplayCurrencySelect.tsx`, in the ticker chrome beside the watchlist button |
| Chart toggle and decomposition | `ChartCurrencyView` in `components/stocks/StockOverviewClient.tsx` |

Nothing is converted in the browser or on the site's server: every converted number shown
is a `converted.value` from the backend. A code not in the list, a list that cannot be
read, or a 422 shows the page without a conversion. The research tabs and the swipe between
them carry `?currency=` so the header keeps its conversion.

Synthetic browser fixtures: `e2e/fixtures/display-currency.mjs` (rates; no KRW rate before
2019 nor in June 2026) and `e2e/fixtures/ticker-page.mjs` (`listings`: two for QAK, one
primary; unavailable for QAS; QAM alone; none for QAL).
