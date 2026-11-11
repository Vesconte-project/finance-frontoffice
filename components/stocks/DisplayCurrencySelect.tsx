'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Info } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Dialog from '@/components/ui/Dialog'
import SegmentedControl from '@/components/ui/SegmentedControl'
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

function placeOf(listing: TrackedListing): string {
  const exchange = exchangeDisplayName(listing.exchange) ?? listing.exchange
  return [exchange, nameOf(regionNames, listing.country) ?? listing.country].filter(Boolean).join(' · ') || 'Exchange not recorded'
}

function listingOption(listing: TrackedListing): string {
  return listing.currency ? `${listing.symbol} · ${listing.currency}` : listing.symbol
}

/**
 * The listings we track, as the page's segmented control (the same one that
 * switches Revenue between an amount and % growth): choosing another listing
 * opens its page. Where the current one trades is said in the traded-price
 * row below, beside its currency.
 */
function ListingSwitch({ ticker, listings, onNavigate }: {
  ticker: string
  listings: TrackedListings
  onNavigate: () => void
}) {
  const router = useRouter()
  if (!listings.available || listings.items.length === 0) {
    return <p className={styles.note} data-tracked-listings="unavailable" data-tracked-listings-empty="">We can’t show the listings we track for {ticker} right now.</p>
  }
  const current = listings.items.find((listing) => listing.isCurrent) ?? null
  const options = listings.items.map(listingOption)
  if (listings.items.length < 2) return null
  return (
    <div className={styles.listings} data-tracked-listings="available">
      <SegmentedControl
        options={options}
        value={current ? listingOption(current) : ''}
        onChange={(option) => {
          const listing = listings.items[options.indexOf(option)]
          if (!listing || listing.isCurrent) return
          onNavigate()
          router.push(`/stocks/${encodeURIComponent(listing.symbol)}`)
        }}
        ariaLabel="Listings we track"
        analyticsId="ticker_listing"
        fill
      />
    </div>
  )
}

/**
 * The ticker header's listings-and-currency control. It speaks the ticker
 * page's segmented-control language (the 1D…ALL range): a capsule track whose
 * chosen option is one solid pill. A traded price — the listing's own
 * currency — fills with the accent; a converted one fills with ink and reads
 * "≈", so the colour tells real from converted without a sentence.
 *
 * One button opens a
 * dialog with the listings of the same company we track (each other listing
 * links to its own page) and the currencies the page can be shown in. The
 * currencies are only those `/v1/currencies` lists; choosing one changes the
 * URL (`?currency=`), the only place the choice lives, and it is the one
 * control for the whole ticker page (founder, 2026-11-05). Nothing is
 * remembered: a new visit starts in the listing's currency.
 */
export default function DisplayCurrencySelect({
  ticker,
  listingCurrency,
  listings,
}: {
  ticker: string
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
  const footnoteId = useId()

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
  const currentListing = listings?.available ? listings.items.find((item) => item.isCurrent) ?? null : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.face}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Listings and currency: ${listingLabel} listing${selected ? `, shown in ${selected}` : ''}`}
        data-display-currency={selected ?? ''}
        data-converted={selected ? '' : undefined}
        onClick={() => setOpen(true)}
      >
        {selected ? <span className={styles.faceFrom} aria-hidden="true">{listingLabel}</span> : null}
        <span className={styles.facePill} data-real={selected ? undefined : ''} aria-hidden="true">
          {selected ? <span className={styles.approx}>≈</span> : null}
          {selected ?? listingLabel}
        </span>
      </button>
      {/* Always mounted, so closing (also from a link) returns focus to the button. */}
      <Dialog
          open={open}
          onClose={close}
          labelledBy={titleId}
          describedBy={footnoteId}
          returnFocusRef={buttonRef}
          className={styles.dialog}
        >
          <div className={styles.panel} data-listings-currency-dialog="">
            <div className={styles.head}>
              <h2 id={titleId} className={styles.title}>Listings and currency</h2>
              <span className={styles.info}>
                <button type="button" className={styles.infoButton} aria-label="About converted prices" aria-describedby={footnoteId}>
                  <Info size={14} strokeWidth={1.5} aria-hidden="true" />
                </button>
                <span id={footnoteId} role="tooltip" className={styles.tooltip}>
                  <span className={`${styles.code} ${styles.real}`} aria-hidden="true">{listingLabel}</span> is the traded price.{' '}
                  <span className={styles.approx}>≈</span> is converted at each day’s rate, not a traded listing. Ratios and scores don’t change.
                </span>
              </span>
            </div>

            {listings ? <ListingSwitch ticker={ticker} listings={listings} onNavigate={close} /> : null}

            <div className={styles.currencies} role="group" aria-label="Show prices in" data-display-currencies="">
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
                    <span className={`${styles.code} ${styles.real}`}>{listingLabel}</span>
                    {currentListing ? (
                      <span className={styles.optionNote} data-listing-current={currentListing.symbol}>
                        {placeOf(currentListing)}
                        <span className="sr-only">, traded price</span>
                      </span>
                    ) : <span className={styles.optionNote}>Traded price</span>}
                    {selected ? null : <Check className={styles.check} size={15} strokeWidth={1.5} aria-hidden="true" />}
                  </Link>
                </li>
              </ul>
              {options.length > 0 ? (
                <ul className={`${styles.list} ${styles.grid}`}>
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
                        <span className={styles.code}><span className={styles.approx} aria-hidden="true">≈</span>{option.code}</span>
                        <span className={styles.optionNote}>
                          {[nameOf(currencyNames, option.code), option.status === 'stale' ? 'older rates' : null].filter(Boolean).join(' · ')}
                        </span>
                        {selected === option.code ? <Check className={styles.check} size={15} strokeWidth={1.5} aria-hidden="true" /> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {currencies.status === 'loading' ? <p className={styles.note} role="status">Loading currencies…</p> : null}
              {unavailable ? <p className={styles.note} role="status" data-display-currencies-unavailable="">Other currencies are unavailable.</p> : null}
            </div>
          </div>
        </Dialog>
    </>
  )
}
