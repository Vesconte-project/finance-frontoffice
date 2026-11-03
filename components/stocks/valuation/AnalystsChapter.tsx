import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ResearchChapter, { ChapterCard, LeadStat } from '@/components/stocks/research/ResearchChapter'
import { analystPrice, readAnalystConsensus, recommendationLabel, targetDistance, type AnalystConsensus } from '@/lib/analyst-consensus'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './AnalystsChapter.module.css'

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function TargetRange({ snapshot }: { snapshot: AnalystConsensus }) {
  const { low, median, high } = snapshot.targets
  if (!snapshot.currency || low === null || median === null || high === null) return null
  const price = snapshot.referencePrice?.value ?? null
  const values = [low, median, high, ...(price === null ? [] : [price])]
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) { const pad = Math.max(Math.abs(min) * 0.05, 0.000001); min -= pad; max += pad }
  const x = (value: number) => 36 + ((value - min) / (max - min)) * 648
  const format = (value: number) => analystPrice(value, snapshot.currency!)
  const titleId = `analyst-target-range-${snapshot.symbol}`
  return (
    <figure className={styles.range} aria-labelledby={titleId}>
      <figcaption id={titleId}>Analyst price targets</figcaption>
      <svg viewBox="0 0 720 132" role="img" aria-label={`Targets for ${snapshot.symbol}: lowest ${format(low)}, median ${format(median)}, highest ${format(high)}${price === null ? '' : `; latest price ${format(price)}`}`}>
        <line className={styles.baseline} x1="36" x2="684" y1="72" y2="72" />
        <line className={styles.band} x1={x(low)} x2={x(high)} y1="72" y2="72" />
        {[low, high].map((value, index) => <line key={index} className={styles.bound} x1={x(value)} x2={x(value)} y1="59" y2="85" />)}
        <circle className={styles.median} cx={x(median)} cy="72" r="9" />
        {price === null ? null : <path className={styles.priceMark} d={`M ${x(price) - 9} 35 L ${x(price)} 47 L ${x(price) + 9} 35 Z`} />}
      </svg>
      <dl className={styles.targetValues}>
        {([['Lowest', low], ['Median', median], ['Highest', high]] as const).map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{format(value)}</dd></div>
        ))}
      </dl>
      {snapshot.referencePrice ? <p className={styles.priceNote}>Triangle: latest price {format(snapshot.referencePrice.value)} · {dateFormat.format(Date.parse(snapshot.referencePrice.asOf))}</p> : null}
    </figure>
  )
}

export default function AnalystsChapter({ data }: { data: StockResearchData }) {
  const snapshot = readAnalystConsensus(data.summary.analystConsensus, data.ticker)
  const median = snapshot?.targets.median ?? null
  const recommendation = recommendationLabel(snapshot?.recommendation ?? null)
  const hasRange = snapshot?.currency && snapshot.targets.low !== null && median !== null && snapshot.targets.high !== null
  return (
    <ResearchChapter
      id="analysts" label="What analysts expect" band
      lead={snapshot?.currency && median !== null ? (
        <>
          <LeadStat value={analystPrice(median, snapshot.currency)} context="Median price target" />
          {snapshot.medianUpside !== null ? <p className={styles.distance}>{targetDistance(snapshot.medianUpside)}</p> : null}
        </>
      ) : <BeingBuilt size="inline">The median price target, and how far it is from the price, is being added.</BeingBuilt>}
      aside={(
        <ChapterCard title="Analyst consensus">
          {recommendation ? <p className={styles.recommendation}>{recommendation}</p> : <BeingBuilt size="inline">The current recommendation is being added.</BeingBuilt>}
          {snapshot?.analystOpinionCount ? <p className={styles.count}>{snapshot.analystOpinionCount} analyst opinions</p> : null}
          <p className={styles.detailNote}><BeingBuiltBadge /> How many analysts say buy, hold or sell, and how the median target moved in 90 days, are being added.</p>
        </ChapterCard>
      )}
    >
      {hasRange && snapshot ? <TargetRange snapshot={snapshot} /> : <BeingBuilt size="chart">The range of price targets, from the lowest to the highest, with the price and the median, is being added.</BeingBuilt>}
      {snapshot && (median !== null || recommendation) ? <p className={styles.source}>Yahoo Finance · observed {dateFormat.format(Date.parse(snapshot.observedAt))}</p> : null}
    </ResearchChapter>
  )
}
