'use client'

import { useState } from 'react'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ReportedLine from '@/components/stocks/research/ReportedLine'
import ResearchChapter, { ChapterCard, LeadStat } from '@/components/stocks/research/ResearchChapter'
import { VALUATION_MULTIPLES, formatMultiple, type MultipleKey, type MultiplePoint } from '@/lib/valuation-reading'
import styles from './Valuation.module.css'

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/**
 * Multiples: the reported history of the chosen multiple, with its highest
 * point and today's value written on the line. The usual range, the median,
 * ten years of history and the sector come from the backend (ENG-89, ENG-91)
 * and are being built.
 */
export default function MultiplesChapter({
  series,
  ticker,
}: {
  series: Record<MultipleKey, MultiplePoint[]>
  ticker: string
}) {
  const [selected, setSelected] = useState<MultipleKey>('pe')
  const chosen = VALUATION_MULTIPLES.find((multiple) => multiple.key === selected)!
  const points = series[selected]
  const latest = points.at(-1) ?? null

  return (
    <ResearchChapter
      id="multiples"
      label="Multiples, last 10 years"
      lead={latest ? (
        <>
          <LeadStat value={formatMultiple(latest.value)} context={`${chosen.label} today · as of ${dayFormat.format(Date.parse(`${latest.date}T00:00:00Z`))}`} />
          <p className={styles.leadNote}><BeingBuiltBadge /> Its usual range and median are being added.</p>
        </>
      ) : (
        <BeingBuilt size="inline">{chosen.label} today, its usual range and its median are being added.</BeingBuilt>
      )}
      aside={(
        <ChapterCard title="All four" meta="today">
          <ul className={styles.multipleList} aria-label="Valuation multiples">
            {VALUATION_MULTIPLES.map((multiple) => {
              const today = series[multiple.key].at(-1) ?? null
              return (
                <li key={multiple.key}>
                  <button
                    type="button"
                    className={styles.multipleRow}
                    aria-pressed={selected === multiple.key}
                    data-multiple={multiple.key}
                    onClick={() => setSelected(multiple.key)}
                  >
                    <span className={styles.multipleName}>
                      <strong>{multiple.label}</strong>
                      <span>{multiple.full}</span>
                    </span>
                    {today ? (
                      <span className={styles.multipleValue}>{formatMultiple(today.value)}</span>
                    ) : (
                      <BeingBuiltBadge />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className={styles.cardNote}>
            <BeingBuiltBadge /> Each multiple’s ten-year range, usual band, median and sector are being added.
          </p>
        </ChapterCard>
      )}
    >
      {points.length >= 2 ? (
        <>
          <ReportedLine
            points={points}
            format={formatMultiple}
            ariaLabel={`${chosen.full} for ${ticker}, ${points[0].date} to ${points.at(-1)!.date}, with the highest point and today’s value written on the line`}
          />
          <p className={styles.chartNote}>
            <BeingBuiltBadge /> Ten years of history, the usual band and the median line are being added.
          </p>
        </>
      ) : (
        <BeingBuilt size="chart">
          {chosen.full} for {ticker} over ten years, with its usual band, median and peak, is being added.
        </BeingBuilt>
      )}
    </ResearchChapter>
  )
}
