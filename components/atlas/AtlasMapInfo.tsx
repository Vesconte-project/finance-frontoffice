'use client'

import type { AtlasLens, AtlasMarketCorrelation } from '@/lib/atlas-model'
import { cohesionChart, type ProFeature } from '@/lib/atlas-pro'
import type { AtlasWeeks } from '@/lib/atlas-pro-model'
import { formatDate } from './atlas-format'
import type { Remote } from './use-atlas-json'
import styles from './AtlasPro.module.css'

/** The cohesion sparkline (pro-spec §5d), or why it is empty. */
function Cohesion({ weeks, lens }: { weeks: Remote<AtlasWeeks>; lens: AtlasLens }) {
  if (lens !== 'residual') return <p className={styles.layerNote}>Shown with the &quot;Beyond the market&quot; view.</p>
  if (weeks.status === 'loading' || weeks.status === 'idle') return <p className={styles.layerNote} role="status">Loading…</p>
  const chart = weeks.status === 'ok' ? cohesionChart(weeks.data.cohesion.map((point) => point.value)) : null
  if (!chart) return <p className={styles.layerNote}>Needs a year of weekly maps.</p>
  return (
    <svg className={styles.spark} viewBox="0 0 300 76" role="img" aria-label={chart.label}>
      <line x1="4" x2="296" y1={chart.yLo} y2={chart.yLo} stroke="var(--line)" />
      <line x1="4" x2="296" y1={chart.yHi} y2={chart.yHi} stroke="var(--line)" />
      <text x="4" y={chart.yHi - 3} fontSize="9" fill="var(--text-muted)">{chart.hi.toFixed(2)}</text>
      <text x="4" y={chart.yLo + 10} fontSize="9" fill="var(--text-muted)">{chart.lo.toFixed(2)}</text>
      <polyline points={chart.points} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={chart.lastX} cy={chart.lastY} r="3" fill="var(--accent)" />
      <text x={chart.lastX - 6} y={chart.lastY > 38 ? Math.min(74, chart.lastY + 12) : chart.lastY - 7} fontSize="9" textAnchor="end" fill="var(--text)">today {chart.last.toFixed(2)}</text>
    </svg>
  )
}

/**
 * "This map": the facts about the map on screen — its week and coverage, how much the market moves
 * together, how faithful the layout is, and (Pro) the market's cohesion over the year.
 */
export default function AtlasMapInfo({ asOf, companies, regions, total, correlation, accuracy, signedIn, pro, weeks, lens, onLocked }: {
  asOf: string
  companies: number
  regions: number
  total: boolean
  correlation: AtlasMarketCorrelation | null
  accuracy: string | null
  signedIn: boolean
  pro: boolean
  weeks: Remote<AtlasWeeks>
  lens: AtlasLens
  onLocked: (feature: ProFeature, anchor: HTMLElement) => void
}) {
  return (
    <>
      <dl className={styles.facts}>
        <div><dt>Week of</dt><dd><time dateTime={asOf}>{formatDate(asOf)}</time></dd></div>
        <div><dt>Companies</dt><dd>{companies.toLocaleString('en-US')}</dd></div>
        <div><dt>Regions</dt><dd>{regions}</dd></div>
      </dl>
      <p className={styles.layerNote}>The latest weekly map{total ? ', drawn from total co-movement' : ''}.</p>

      <h3 className={styles.layerGroup}>Average correlation</h3>
      {correlation ? (
        <p className={styles.metric}>
          <b>{correlation.value.toFixed(2)}</b>
          {correlation.comparedWithLastYear ? ` · ${correlation.comparedWithLastYear === 'usual' ? 'about usual' : correlation.comparedWithLastYear} for this market over the last year` : ''}
        </p>
      ) : (
        <p className={styles.layerNote}>{signedIn ? 'Not measured for this week.' : 'Shown with a free account.'}</p>
      )}

      <h3 className={styles.layerGroup}>Map accuracy</h3>
      {accuracy ? (
        <p className={styles.metric}><b>{accuracy}</b> of each company&apos;s 10 strongest relationships are, on average, among its 10 nearest neighbours on the map.</p>
      ) : <p className={styles.layerNote}>{signedIn ? 'Not measured for this week.' : 'Shown with a free account.'}</p>}

      <h3 className={styles.layerGroup}>Market cohesion, last year {pro ? null : <span className={styles.proTag}>Pro</span>}</h3>
      {pro ? <Cohesion weeks={weeks} lens={lens} /> : (
        <button type="button" className={`${styles.empty} ${styles.lockedNote}`} onClick={(event) => onLocked('cohesion', event.currentTarget)}>
          Average correlation across the market, week by week, over the last year.
        </button>
      )}
    </>
  )
}
