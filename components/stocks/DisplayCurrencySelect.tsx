'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import Dialog from '@/components/ui/Dialog'
import { useDisplayCurrencies, useDisplayCurrencyParam } from '@/hooks/useDisplayCurrency'
import { isoCurrency, withDisplayCurrency, type TrackedListing, type TrackedListings } from '@/lib/display-currency'
import { exchangeDisplayName } from '@/lib/exchange-names'
import styles from './DisplayCurrencySelect.module.css'

function displayNames(type: 'region' | 'currency'): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(['en'], { type })
  } catch {
    return null
  }
}

const regionNames = displayNames('region')
const currencyNames = displayNames('currency')

function nameOf(names: Intl.DisplayNames | null, code: string | null): string | null {
  if (!code) return null
  try {
    const name = names?.of(code)
    return name && name !== code ? name : null
  } catch {
    return null
  }
}

function ListingLine({ listing }: { listing: TrackedListing }) {
  const exchange = exchangeDisplayName(listing.exchange) ?? listing.exchange
  const place = [exchange, listing.exchangeMic && listing.exchangeMic !== exchange ? listing.exchangeMic : null, nameOf(regionNames, listing.country) ?? listing.country]
    .filter(Boolean)
    .join(' · ')
  return (
    <>
      <span className={styles.listingHead}>
        <span className={styles.symbol}>{listing.symbol}</span>
        {listing.isPrimary ? <span className={styles.badge} data-listing-primary="">Primary</span> : null}
        {listing.isCurrent ? <span className={styles.badge} data-listing-current="">This page</span> : null}
        <span className={styles.listingCurrency}>{listing.currency ?? 'Currency not recorded'}</span>
      </span>
      <span className={styles.place}>{place || 'Exchange not recorded'}</span>
    </>
  )
}

function ListingsSection({ ticker, displayName, listings, onNavigate }: {
  ticker: string
  displayName: string
  listings: TrackedListings
  onNavigate: () => void
}) {
  const headingId = useId()
  const onlyOne = listings.available && listings.items.length === 1 && listings.items[0].isCurrent
  return (
    <section className={styles.section} aria-labelledby={headingId} data-tracked-listings={listings.available ? 'available' : 'unavailable'}>
      <h3 id={headingId} className={styles.sectionTitle}>Listings we track</h3>
      {listings.available && listings.items.length > 0 ? (
        <>
          <p className={styles.note}>Each listing trades on its own exchange, in its own currency.</p>
          <ul className={styles.list}>
            {listings.items.map((listing) => (
              <li key={listing.symbol}>
                {listing.isCurrent ? (
                  <div className={styles.row} aria-current="page" data-listing={listing.symbol}>
                    <ListingLine listing={listing} />
                  </div>
                ) : (
                  <Link
                    prefetch={false}
                    href={`/stocks/${encodeURIComponent(listing.symbol)}`}
                    className={styles.row}
                    data-listing={listing.symbol}
                    onClick={onNavigate}
                  >
                    <ListingLine listing={listing} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {onlyOne ? <p className={styles.note}>This is the only listing of {displayName} we track.</p> : null}
        </>
      ) : (
        <p className={styles.note} data-tracked-listings-empty="">We can’t show the listings we track for {ticker} right now.</p>
      )}
    </section>
  )
}

/**
 * The ticker header's listings-and-currency control: one button that opens a
 * dialog with the listings of the same company we track (each other listing
 * links to its own page) and the currencies the price can also be shown in.
 * The currencies are only those `/v1/currencies` lists; choosing one changes
 * the URL (`?currency=`), which is the only place the choice lives. The page
 * keeps the listing's own currency: a converted price sits beside it.
 */
export default function DisplayCurrencySelect({
  ticker,
  displayName,
  listingCurrency,
  listings,
}: {
  ticker: string
  displayName: string
  listingCurrency: string | null
  listings: TrackedListings | null
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = useDisplayCurrencyParam()
  const [open, setOpen] = useState(false)
  const currencies = useDisplayCurrencies(open)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const currencyHeadingId = useId()

  const listing = isoCurrency(listingCurrency)
  const listingLabel = listing ?? listingCurrency ?? 'Listing'
  const available = currencies.status === 'ready' && currencies.payload.available
  const options = available ? currencies.payload.currencies.filter((option) => option.code !== listing) : []
  // A code the backend does not list is ignored, as the page ignores it.
  const selected = current && current !== listing && (currencies.status !== 'ready' || options.some((option) => option.code === current))
    ? current
    : null
  const unavailable = currencies.status === 'error' || (currencies.status === 'ready' && !available)
  const hrefFor = (code: string | null) => withDisplayCurrency(`${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`, code)
  const close = () => setOpen(false)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.face}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Listings and currency: ${listingLabel} listing${selected ? `, price also shown in ${selected}` : ''}`}
        data-display-currency={selected ?? ''}
        data-converted={selected ? '' : undefined}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">{listingLabel}{selected ? <> ≈ {selected}</> : null}</span>
      </button>
      {/* Always mounted, so closing (also from a link) returns focus to the button. */}
      <Dialog
          open={open}
          onClose={close}
          labelledBy={titleId}
          describedBy={descriptionId}
          returnFocusRef={buttonRef}
          className={styles.dialog}
        >
          <div className={styles.panel} data-listings-currency-dialog="">
            <h2 id={titleId} className={styles.title}>Listings and currency</h2>
            <p id={descriptionId} className={styles.lead}>
              Where we track {displayName}, and the currencies its price can also be shown in.
            </p>

            {listings ? <ListingsSection ticker={ticker} displayName={displayName} listings={listings} onNavigate={close} /> : null}

            <section className={styles.section} aria-labelledby={currencyHeadingId} data-display-currencies="">
              <h3 id={currencyHeadingId} className={styles.sectionTitle}>Show the price in</h3>
              <p className={styles.note}>
                A converted price uses the exchange rate of each day. It is not a listing traded in that currency.
                Indicators, signals, scores and financial statements stay in {listingLabel}.
              </p>
              <ul className={styles.list}>
                <li>
                  <Link
                    href={hrefFor(null)}
                    replace
                    scroll={false}
                    prefetch={false}
                    className={styles.row}
                    aria-current={selected ? undefined : 'true'}
                    data-currency-option=""
                    onClick={close}
                  >
                    <span className={styles.listingHead}>
                      <span className={styles.symbol}>{listingLabel}</span>
                      <span className={styles.optionNote}>listing currency, no conversion</span>
                    </span>
                  </Link>
                </li>
                {options.map((option) => (
                  <li key={option.code}>
                    <Link
                      href={hrefFor(option.code)}
                      replace
                      scroll={false}
                      prefetch={false}
                      className={styles.row}
                      aria-current={selected === option.code ? 'true' : undefined}
                      data-currency-option={option.code}
                      onClick={close}
                    >
                      <span className={styles.listingHead}>
                        <span className={styles.symbol}>{option.code}</span>
                        <span className={styles.optionNote}>
                          {[nameOf(currencyNames, option.code), option.status === 'stale' ? 'older rates' : null].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {currencies.status === 'loading' ? <p className={styles.note} role="status">Loading the currencies we can show.</p> : null}
              {unavailable ? <p className={styles.note} role="status" data-display-currencies-unavailable="">Other currencies are unavailable right now.</p> : null}
            </section>
          </div>
        </Dialog>
    </>
  )
}
