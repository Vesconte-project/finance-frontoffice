# Display currency on the ticker pages (consumption notes)

Primary contract: finance-backend README "Display Currency Contract" (`app/fx.py`,
`app/ticker_money.py`). These notes describe how the frontoffice consumes it; they
are not contract truth.

## What the backend gives

- `GET /v1/currencies` → `{available, reason, pivot: "USD", maxStalenessBusinessDays, currencies: [{code, latestRateDate, status}]}`.
  USD comes first. Without the FX tables the list is USD alone with `available: false`.
- `?currency=XXX` on `summary`, `profile`, `history`, `ohlc`, `technical-series`,
  `financial-statements`, `market-metrics`, `corporate-actions` and
  `equity-capital-events`. Without it every response is unchanged. With it, each object
  holding amounts gains `money: {<field>: {value, currency, sourceCurrency, date, converted: {value, currency, rate, rateDate} | null, unconvertedReason}}`,
  each amount at the rate of its own date. An unlisted code is 422 `unsupported_currency`.

## How the site uses it

| Piece | Where |
| --- | --- |
| Local route for the list | `GET /api/currencies` (`app/api/currencies/route.ts`) |
| Converted quote for the chrome (the layout does not see `?currency=`) | `GET /api/stocks/{ticker}/quote?currency=XXX` |
| Full price history in a currency | `GET /api/stocks/{ticker}/history?currency=XXX` (422 for an unlisted code) |
| Server reads | `lib/display-currency-server.ts` (`resolveDisplayCurrency`, `fetchInDisplayCurrency`), used by `lib/ticker-data.ts`, `lib/finance.ts`, `lib/canonical-research.ts`, `lib/stock-research.ts` |
| Parsing and display | `lib/display-currency.ts` (pure, unit-tested in `tests/display-currency.test.ts`) |
| Selector | `components/stocks/DisplayCurrencySelect.tsx`, in the ticker chrome beside the watchlist button |
| One amount | `components/ui/Money.tsx`: converted figure, the reported one beside it, or the reported one with a "not in USD" marker and its reason |
| Page line | `components/stocks/DisplayCurrencyNote.tsx`: what the figures are and how many have no value in the currency |

Rules:

- Nothing is converted in the browser or on the site's server: every number shown in
  a display currency is a `converted.value` from the backend.
- `applyDisplayCurrency` puts the converted value in the field's place and `null` when
  there is none, so charts (price line, candles, the expanded chart and the technical
  summary computed from the bars) never mix currencies: a day without a rate is left
  out and counted on the page line.
- Single figures keep the reported amount beside the converted one ("$54.11 · ₩75,000");
  the reported amount uses `value`/`currency` (minor units already scaled) and the
  tooltip names `sourceCurrency` (GBp), never `asset.currency`.
- An amount the backend does not annotate (net cash, earnings revenue without a
  currency) is shown as reported with the marker, never relabelled; so is the quote's
  preformatted `marketCapText` when no annotated market cap exists.
- A code not in the list, a list that cannot be read, or a 422 shows the page as reported.

## Preference (interim)

The choice is kept in the URL (`?currency=XXX`, carried by the research tabs and the
swipe between them) and in this browser (`localStorage["vesconte:display-currency"]`,
read and written in try/catch; `""` means "as reported"). A ticker page opened without
`?currency=` follows the stored choice. This is interim until the account preference
exists; that needs the platform migration, pending approval.

## Not converted yet

- Profile facts (Business tab, fund figures) are converted when the backend annotates the
  row (market cap, assets, dividend rate); any other amount there is shown as reported and
  marked "(not in USD)".
- Earnings estimates and actuals carry no currency in the read model, so the Events tab
  shows them as reported and marked.
- The technical-series read is not consumed by the site today; the indicators drawn on
  the Overview are computed from the converted bars.
