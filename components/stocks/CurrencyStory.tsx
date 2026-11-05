import type { ReactNode } from 'react'
import ChartFrame, { ChartLabel, ChartPlot } from '@/components/stocks/research/ChartFrame'
import ResearchChapter, { ChapterCard } from '@/components/stocks/research/ResearchChapter'
import { currencyName, indexedInBothCurrencies, type ConvertedClose, type CurrencyDecomposition } from '@/lib/display-currency'
import styles from './CurrencyStory.module.css'

const WIDE = { width: 1000, height: 300 }
const COMPACT = { width: 600, height: 380 }

export const RANGE_WORDS: Record<string, string> = {
  '1D': 'today',
  '5D': 'the last five days',
  '1M': 'the last month',
  '3M': 'the last three months',
  YTD: 'this year so far',
  '1Y': 'the last year',
  '5Y': 'the last five years',
  '10Y': 'the last ten years',
  ALL: 'the whole history shown',
}

function percent(value: number, signed = true): string {
  const text = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.abs(value * 100))
  return `${signed ? (value >= 0 ? '+' : '−') : ''}${text}%`
}

function day(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

const tone = (value: number) => (value > 0 ? 'up' : value < 0 ? 'down' : undefined)

function Lines({ points, listing, display, variant }: {
  points: ConvertedClose[]
  listing: string
  display: string
  variant: 'wide' | 'compact'
}) {
  const box = variant === 'wide' ? WIDE : COMPACT
  const lines = indexedInBothCurrencies(points)
  const values = [...lines.listing, ...lines.display].map((point) => point.value)
  const low = Math.min(100, ...values)
  const high = Math.max(100, ...values)
  const pad = (high - low || 1) * 0.12
  const right = variant === 'wide' ? 150 : 110
  const top = 18
  const bottom = box.height - 26
  const count = lines.listing.length
  const x = (index: number) => (index / Math.max(1, count - 1)) * (box.width - right)
  const y = (value: number) => bottom - ((value - (low - pad)) / (high + pad - (low - pad))) * (bottom - top)
  const path = (series: { value: number }[]) => series.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ')
  const band = `${path(lines.display)} ${[...lines.listing].reverse().map((point, index) => `L ${x(count - 1 - index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ')} Z`
  const lastListing = lines.listing[count - 1]?.value ?? 100
  const lastDisplay = lines.display[count - 1]?.value ?? 100
  const effect = lastDisplay - lastListing
  // Keep the two end labels apart when the lines end close together.
  const gap = 22
  let listingY = y(lastListing)
  let displayY = y(lastDisplay)
  if (Math.abs(listingY - displayY) < gap) {
    const middle = (listingY + displayY) / 2
    const displayAbove = lastDisplay >= lastListing
    displayY = middle + (displayAbove ? -gap / 2 : gap / 2)
    listingY = middle + (displayAbove ? gap / 2 : -gap / 2)
  }
  const endX = x(count - 1) + 10
  return (
    <ChartPlot
      box={box}
      variant={variant}
      labels={(
        <>
          {/* At the baseline's right end, on the side the lines do not end on, so it never sits on them. */}
          <ChartLabel box={box} x={box.width - right} y={y(100) + (Math.min(lastListing, lastDisplay) >= 100 ? 12 : -12)} anchor="end" tone="muted">Start = 100</ChartLabel>
          <ChartLabel box={box} x={endX} y={displayY} anchor="start" strong>{`In ${display} ${percent(lastDisplay / 100 - 1)}`}</ChartLabel>
          <ChartLabel box={box} x={endX} y={listingY} anchor="start" tone="muted">{`In ${listing} ${percent(lastListing / 100 - 1)}`}</ChartLabel>
          <ChartLabel box={box} x={0} y={box.height - 8} anchor="start" tone="muted">{day(points.find((point) => point.converted !== null)?.date ?? points[0].date)}</ChartLabel>
          <ChartLabel box={box} x={x(count - 1)} y={box.height - 8} anchor="end" tone="muted">{day(lines.listing[count - 1]?.date ?? points[points.length - 1].date)}</ChartLabel>
        </>
      )}
    >
      <line x1={0} x2={box.width - right} y1={y(100)} y2={y(100)} className={styles.base} />
      <path d={band} className={styles.band} data-tone={effect >= 0 ? 'up' : 'down'} />
      <path d={path(lines.listing)} className={styles.listing} />
      <path d={path(lines.display)} className={styles.display} />
      <circle cx={x(count - 1)} cy={y(lastDisplay)} r={4} className={styles.displayEnd} />
      <circle cx={x(count - 1)} cy={y(lastListing)} r={3.5} className={styles.listingEnd} />
    </ChartPlot>
  )
}

/**
 * What the display currency did to the company's return over the range the
 * hero chart shows: the price in both currencies from the same start (100), the
 * gap between them shaded as the currency's part, and the split said in words.
 * Every number comes from the backend's reported and converted closes of the
 * same days; days without a conversion are left out and counted.
 */
export default function CurrencyStory({
  ticker,
  listing,
  display,
  range,
  points,
  split,
  excludedDays,
  state,
}: {
  ticker: string
  listing: string
  display: string
  /** The hero chart's range (1Y, 5Y…). */
  range: string
  /** The range's closes with their conversion. */
  points: ConvertedClose[]
  split: CurrencyDecomposition | null
  excludedDays: number
  state: 'loading' | 'loaded' | 'error'
}) {
  const listingName = currencyName(listing)
  const displayName = currencyName(display)
  const words = RANGE_WORDS[range] ?? 'this range'
  const excluded = excludedDays > 0
    ? `${excludedDays} ${excludedDays === 1 ? 'day' : 'days'} without a ${display} rate ${excludedDays === 1 ? 'is' : 'are'} left out.`
    : `Every day in this range has a ${display} rate.`

  let body: ReactNode
  if (state === 'loading') {
    body = <p className={styles.note} role="status">Loading {ticker} in {display}.</p>
  } else if (state === 'error') {
    body = <p className={styles.note} role="status" data-currency-story-error="">{ticker} in {display} could not be loaded. Prices stay in {listing}.</p>
  } else if (!split) {
    body = <p className={styles.note}>Fewer than two days in {words} have a {display} rate, so the two currencies cannot be compared. {excluded}</p>
  } else {
    const gained = split.currencyEffect >= 0
    body = (
      <>
        <p className={styles.lead} data-currency-story-sentence="">
          Over {words}, {ticker} returned <b data-tone={tone(split.convertedReturn)}>{percent(split.convertedReturn)}</b> in {display}.
          {' '}In {listing}, its own currency, it returned <b data-tone={tone(split.localReturn)}>{percent(split.localReturn)}</b>; the {listingName}
          {gained ? ' gained ' : ' lost '}
          <b data-tone={tone(split.currencyEffect)}>{percent(split.currencyEffect, false)}</b> against the {displayName}, which
          {gained ? ' added to ' : ' took from '}the return.
        </p>
        <ChartFrame ariaLabel={`${ticker} in ${listing} and in ${display}, both from 100 at the start of ${words}`}>
          <Lines points={points} listing={listing} display={display} variant="wide" />
          <Lines points={points} listing={listing} display={display} variant="compact" />
        </ChartFrame>
      </>
    )
  }

  return (
    <ResearchChapter
      id="currency"
      label="What the currency did"
      aside={split && state === 'loaded' ? (
        <ChapterCard title={`${listing} to ${display}`} meta={`${day(split.from)} to ${day(split.to)}`}>
          <dl className={styles.split} data-currency-decomposition="">
            <div>
              <dt>The company, in {listing}</dt>
              <dd data-tone={tone(split.localReturn)} data-decomposition="local">{percent(split.localReturn)}</dd>
            </div>
            <div>
              <dt>The currency, {listing} against {display}</dt>
              <dd data-tone={tone(split.currencyEffect)} data-decomposition="currency">{percent(split.currencyEffect)}</dd>
            </div>
            <div data-total="">
              <dt>Together, in {display}</dt>
              <dd data-tone={tone(split.convertedReturn)} data-decomposition="converted">{percent(split.convertedReturn)}</dd>
            </div>
          </dl>
          <p className={styles.note} data-decomposition-range="">
            Converted at each day’s exchange rate; it is not a listing traded in {display}. {excluded}
          </p>
        </ChapterCard>
      ) : undefined}
    >
      <div data-currency-story={display}>{body}</div>
    </ResearchChapter>
  )
}
