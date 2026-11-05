# Display currency and listings we track on the ticker pages (consumption notes)

Primary contract: finance-backend README "Display Currency Contract" (`app/fx.py`,
`app/ticker_money.py`) and the summary's `listings` block (`app/entity_resolver.py`).
These notes describe how the frontoffice consumes them; they are not contract truth.

## What the backend gives

- `GET /v1/currencies` → `{available, reason, pivot: "USD", maxStalenessBusinessDays, currencies: [{code, latestRateDate, status}]}`.
  USD comes first. Without the FX tables the list is USD alone with `available: false`.
- `?currency=XXX` on the ticker reads. Without it every response is unchanged. With it,
  every original amount stays in place and each object holding amounts gains
  `money: {<field>: {value, currency, sourceCurrency, date, price_basis: "adjusted" | "raw" | null, converted: {value, currency, rate, rateDate} | null, unconvertedReason}}`,
  each amount at the rate of its own date. An unlisted code is 422 `unsupported_currency`.
- `GET /v1/tickers/{ticker}/summary` carries a top-level `listings` block, unaffected by
  `?currency=`: `{available, reason, items: [{symbol, exchange, exchangeMic, country, currency, isPrimary, isCurrent}]}`,
  primary first, then by symbol. `exchange`, `exchangeMic`, `country` and `currency` may be
  null; an unavailable block (`symbol_absent`, `provisional_only`, `entity_tables_absent`, …)
  has no items.

## Product rules (founder, 2026-11-05)

These replace the 2026-10-20 rules, which kept every tab in the listing's currency and
put a separate "Show in {CCY}" toggle under the Overview chart. The founder clarified
that the header choice is meant to change the ticker's data on every tab.

- **One control.** The header's "Listings and currency" choice is the only one. Choosing a
  currency shows the ticker page in it; choosing the listing's currency (or none) shows it
  as reported. There is no second toggle on the page.
- **It lives only in the URL** (`?currency=XXX`) and travels from tab to tab; a reload or a
  shared link keeps it. Nothing is remembered: no browser storage, no account preference,
  so a new visit starts in the listing's currency.
- **Every amount the backend converts is shown converted**, at the rate of its own date;
  ratios, percentages, scores and correlations do not change. An amount the backend
  cannot convert (`unconvertedReason`, e.g. EPS estimates and actuals, which carry no
  currency) stays as reported and is marked with its currency.
- **Overview:**
  - the price chart is drawn in the display currency (the backend's value of each day);
  - candles stay in the listing currency until the expanded chart converts OHLC, so the
    candle toggle is hidden while a currency is chosen;
  - market value under the chart is the backend's conversion of the value the page shows;
  - a chapter, "What the currency did", follows the chart, over the chart's range:
    - the price in both currencies from the same start (100), with the gap between them
      shaded as the currency's part;
    - the split in words and figures: the company in its own currency, the currency
      against the display currency ((1 + r_ccy) / (1 + r_local) − 1), and the two together;
    - days without a conversion are left out of both lines and counted.
- **Other tabs** (Fundamentals, Financials, Valuation, Ownership & Capital, Events) follow
  in a second change; the expanded chart's currency comparison in a third.

## How the site uses it

| Piece | Where |
| --- | --- |
| Local route for the list | `GET /api/currencies` (`app/api/currencies/route.ts`) |
| Header conversion (the layout does not see `?currency=`) | `GET /api/stocks/{ticker}/quote?currency=XXX` → `{ticker, currency, converted: {value, currency, rateDate} \| null, unconvertedReason}` |
| Chart in a currency | `GET /api/stocks/{ticker}/history?currency=XXX` → `[{date, close, price_basis: "adjusted", converted \| null}]` (422 for an unlisted code) |
| Listings | `summary.listings`, read by `lib/stock-ticker-chrome.ts` with `parseTrackedListings` |
| Server reads | `lib/display-currency-server.ts` (`resolveDisplayCurrency`, `fetchInDisplayCurrency`), used by `lib/ticker-data.ts` and `lib/finance.ts` (`getConvertedCloses`) |
| Parsing and the decomposition | `lib/display-currency.ts` (pure, unit-tested in `tests/display-currency.test.ts`) |
| Control and dialog | `components/stocks/DisplayCurrencySelect.tsx`, in the ticker chrome beside the watchlist button |
| Overview chart in the currency | `StockOverviewClient.tsx` (loads `history?currency=` when a currency is chosen) |
| What the currency did | `components/stocks/CurrencyStory.tsx`, `indexedInBothCurrencies` and `currencyDecomposition` in `lib/display-currency.ts` |

Nothing is converted in the browser or on the site's server: every converted number shown
is a `converted.value` from the backend. The only arithmetic is on those values: the
range's returns and their split, and indexing both lines to 100. A code not in the list, a list that cannot be
read, or a 422 shows the page without a conversion. The research tabs and the swipe between
them carry `?currency=` so the header keeps its conversion.

Synthetic browser fixtures: `e2e/fixtures/display-currency.mjs` (rates; no KRW rate before
2019 nor in June 2026) and `e2e/fixtures/ticker-page.mjs` (`listings`: two for QAK, one
primary; unavailable for QAS; QAM alone; none for QAL).

## Adjusted prices, availability and rollout (2026-10-25)

Backend contract `2026-10-25.2` retains `price_basis` on every historical
point and its `money` entry. The native chart and the optional converted line
use adjusted closes (splits and dividends); the visible label is
“ajustado a splits e dividendos”. The header quote and daily movement remain raw;
its additional conversion must carry raw basis too. Missing or mismatched basis
is refused, never replaced with a raw price under an adjusted label.

Candles and technical overlays stay in the listing currency. Overlays require
`availability_status: ready`, adjusted series and adjusted points. Stale/invalid
inputs hide overlays. The history proxy preserves the backend's typed HTTP 409
`adjusted_price_input_invalid`, instead of returning a raw series. Converted
history uses `cache: no-store`; native chart cache identity is
`adjusted-fx-v4`. Missing/stale FX produces null converted points and explicit
excluded-day counts; no browser-side FX calculation or rate fill occurs.

The latest product decision in this PR supersedes the original page-wide
conversion proposal: research, statements and indicators remain native.
(Itself superseded on 2026-11-05: see "Product rules" above.)
No merge or deploy before the Vercel reopening (ENG-196). Backend #63 must be
reviewed first; merging it requires regeneration and review of the reopening
blocks currently pinned to backend `d0bffc1`. Francisco reviews this frontend.
