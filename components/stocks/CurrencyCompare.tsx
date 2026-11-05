'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useDisplayCurrencies } from '@/hooks/useDisplayCurrency'
import { browserRead } from '@/lib/read-client'
import { compareFrom, percentTicks, type CompareSeries } from '@/lib/currency-compare'
import { DISPLAY_CURRENCY_PARAM, currencyName, parseConvertedCloses } from '@/lib/display-currency'
import { ADJUSTED_CHART_VERSION } from '@/lib/price-basis'
import styles from './CurrencyCompare.module.css'

/** At most this many currencies on the chart at once, so the lines stay readable. */
export const MAX_COMPARED = 4
const BOX = { width: 1000, height: 420 }
const PAD = { left: 8, right: 8, top: 16, bottom: 28 }
/** One colour per line, by its place in the selection: the first is the accent. */
const LINE_COLORS = ['var(--accent)', 'var(--text)', 'var(--up-ink, var(--up))', 'color-mix(in srgb, var(--down) 70%, var(--accent))']

type Load = { status: 'loading' } | { status: 'ready'; points: CompareSeries['points'] } | { status: 'error' }

function percent(value: number): string {
  const text = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.abs(value * 100))
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${text}%`
}

function day(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

/**
 * The company's price in several currencies at once, each line the change
 * since the same first day of the chosen range: the gap between two lines is
 * how those currencies moved against each other over it. The listing's line is
 * its reported closes; every other line is the backend's conversion of each
 * day's close. Days without a rate in any chosen currency are left out of all.
 */
export default function CurrencyCompare({
  ticker,
  listing,
  listingCloses,
  start,
  initial,
}: {
  ticker: string
  listing: string
  /** The listing's reported closes. */
  listingCloses: CompareSeries['points']
  /** First day of the range the chart shows. */
  start: string
  /** Currencies chosen when the view opens. */
  initial: string[]
}) {
  const currencies = useDisplayCurrencies(true)
  const [selected, setSelected] = useState<string[]>(() => [...new Set(initial)].slice(0, MAX_COMPARED))
  const [loads, setLoads] = useState<Record<string, Load>>({})
  const [hover, setHover] = useState<number | null>(null)
  const requested = useRef(new Set<string>())

  // Each currency other than the listing's is read once, as the backend converts it.
  useEffect(() => {
    for (const code of selected) {
      if (code === listing || requested.current.has(code)) continue
      requested.current.add(code)
      void browserRead(`/api/stocks/${encodeURIComponent(ticker)}/history?${DISPLAY_CURRENCY_PARAM}=${encodeURIComponent(code)}&price_basis=${ADJUSTED_CHART_VERSION}`, { cache: 'no-store' })
        .then(async (response) => {
          const points = parseConvertedCloses(await response.json().catch(() => null))
            .flatMap((point) => (point.converted === null ? [] : [{ date: point.date, value: point.converted }]))
          if (!response.ok || points.length < 2) throw new Error('unavailable')
          setLoads((current) => ({ ...current, [code]: { status: 'ready', points } }))
        })
        .catch(() => setLoads((current) => ({ ...current, [code]: { status: 'error' } })))
    }
  }, [selected, listing, ticker])
  const statusOf = (code: string): Load['status'] => (code === listing ? 'ready' : loads[code]?.status ?? 'loading')

  const options = useMemo(() => {
    const listed = currencies.status === 'ready' && currencies.payload.available ? currencies.payload.currencies.map((item) => item.code) : []
    return [listing, ...listed.filter((code) => code !== listing)]
  }, [currencies, listing])

  const ready = selected.filter((code) => statusOf(code) === 'ready')
  const series: CompareSeries[] = ready.map((code) => ({
    code,
    points: code === listing ? listingCloses : (loads[code] as { points: CompareSeries['points'] }).points,
  }))
  const result = compareFrom(series, start)

  const toggle = (code: string) => {
    setHover(null)
    setSelected((current) => current.includes(code)
      ? current.filter((item) => item !== code)
      : current.length >= MAX_COMPARED ? current : [...current, code])
  }

  const all = result.lines.flatMap((line) => line.changes)
  const ticks = all.length ? percentTicks(Math.min(0, ...all), Math.max(0, ...all)) : []
  const low = Math.min(0, ...all, ...ticks)
  const high = Math.max(0, ...all, ...ticks)
  const count = result.dates.length
  const plotWidth = BOX.width - PAD.left - PAD.right
  const x = (index: number) => PAD.left + (index / Math.max(1, count - 1)) * plotWidth
  const y = (value: number) => PAD.top + (1 - (value - low) / (high - low || 1)) * (BOX.height - PAD.top - PAD.bottom)
  const path = (changes: number[]) => changes.map((value, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')
  const colorOf = (code: string) => LINE_COLORS[Math.max(0, selected.indexOf(code)) % LINE_COLORS.length]
  const shown = hover ?? count - 1

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!count) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    const index = Math.round(((ratio * BOX.width - PAD.left) / plotWidth) * (count - 1))
    setHover(Math.max(0, Math.min(count - 1, index)))
  }

  const pending = selected.filter((code) => statusOf(code) === 'loading')
  const failed = selected.filter((code) => statusOf(code) === 'error')

  return (
    <div className={styles.compare} data-currency-compare="">
      <div className={styles.chips} role="group" aria-label={`Currencies to compare, up to ${MAX_COMPARED}`}>
        {options.map((code) => {
          const on = selected.includes(code)
          const line = result.lines.find((item) => item.code === code)
          return (
            <button
              key={code}
              type="button"
              className={styles.chip}
              aria-pressed={on}
              disabled={!on && selected.length >= MAX_COMPARED}
              onClick={() => toggle(code)}
              style={on ? { '--swatch': colorOf(code) } as CSSProperties : undefined}
              data-compare-currency={code}
              title={currencyName(code)}
            >
              <i aria-hidden="true" />
              <b>{code}</b>
              {code === listing ? <small>listing</small> : null}
              {on && line ? <span>{percent(line.changes[shown] ?? line.last)}</span> : null}
            </button>
          )
        })}
      </div>

      {count >= 2 ? (
        <div className={styles.plot}>
          <svg
            viewBox={`0 0 ${BOX.width} ${BOX.height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${ticker} in ${ready.join(', ')}: change since ${day(result.dates[0])}. ${result.lines.map((line) => `${line.code} ${percent(line.last)}`).join(', ')}.`}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((tick) => (
              <line key={tick} x1={PAD.left} x2={BOX.width - PAD.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? styles.zero : styles.grid} />
            ))}
            {result.lines.map((line) => (
              <path key={line.code} d={path(line.changes)} className={styles.line} style={{ stroke: colorOf(line.code) }} data-compare-line={line.code} />
            ))}
            {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={BOX.height - PAD.bottom} className={styles.cursor} /> : null}
          </svg>
          <div className={styles.labels} aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} className={styles.tick} style={{ top: `${(y(tick) / BOX.height) * 100}%` }}>{percent(tick)}</span>
            ))}
            <span className={styles.dateStart}>{day(result.dates[0])}</span>
            <span className={styles.dateEnd}>{day(result.dates[shown])}</span>
          </div>
        </div>
      ) : (
        <p className={styles.note} role="status">
          {pending.length ? `Loading ${ticker} in ${pending.join(', ')}.` : 'Choose at least one currency with prices in this range.'}
        </p>
      )}

      <p className={styles.note} data-compare-note="">
        Each line is {ticker}’s price in that currency, from the same day at 0%: the gap between two lines is how those
        currencies moved against each other. {listing} is the listing’s price; the others are converted at each day’s rate.
        {result.leftOut > 0 ? ` ${result.leftOut} ${result.leftOut === 1 ? 'day' : 'days'} without a rate in every chosen currency ${result.leftOut === 1 ? 'is' : 'are'} left out.` : ''}
        {failed.length ? ` ${failed.join(', ')} could not be loaded.` : ''}
      </p>
    </div>
  )
}
