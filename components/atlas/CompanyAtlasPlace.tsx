import Link from 'next/link'
import ResearchChapter from '@/components/stocks/research/ResearchChapter'
import type { AtlasCompanyPanel } from '@/lib/atlas-model'
import styles from './CompanyAtlasPlace.module.css'

function formatWeek(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/**
 * A company on the weekly atlas, for a signed-in reader: the region it belongs to,
 * how its strongest ties split between regions, and the companies it moves with
 * most once the whole market is taken out.
 */
export default function CompanyAtlasPlace({ panel }: { panel: AtlasCompanyPanel }) {
  const region = panel.zoneLabel ?? 'its region'
  return (
    <>
      <ResearchChapter
        id="atlas-region"
        label="Where it sits"
        actions={<Link href="/markets/network" className={styles.link}>Open the atlas →</Link>}
      >
        <p className={styles.lead}>
          {panel.symbol} is in <b>{region}</b> on the atlas for the week of {formatWeek(panel.asOf)}.
        </p>
        {panel.memberships.length ? (
          <ul className={styles.shares} aria-label={`How ${panel.symbol}'s strongest ties split between regions`}>
            {panel.memberships.map((membership) => (
              <li key={membership.zoneId}>
                <span>{membership.label ?? membership.zoneId}</span>
                <span className={styles.bar} aria-hidden="true"><span style={{ width: `${Math.round(membership.share * 100)}%` }} /></span>
                <strong>{Math.round(membership.share * 100)}%</strong>
              </li>
            ))}
          </ul>
        ) : null}
        <p className={styles.note}>The share of its 15 strongest ties, above the market average, that land in each region.</p>
      </ResearchChapter>
      <ResearchChapter id="related-companies" label="Moves most with" band>
        {panel.neighbours.length ? (
          <ol className={styles.neighbours} aria-label={`Companies that move most with ${panel.symbol}`}>
            {panel.neighbours.map((neighbour) => (
              <li key={neighbour.symbol}>
                <Link prefetch={false} href={`/stocks/${encodeURIComponent(neighbour.symbol)}`}>
                  <b>{neighbour.symbol}</b>
                  {neighbour.name ? <span>{neighbour.name}</span> : null}
                </Link>
                <span className={styles.bar} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(1, neighbour.correlation)) * 100}%` }} /></span>
                <strong aria-label={`Correlation ${neighbour.correlation.toFixed(2)}`}>{neighbour.correlation.toFixed(2)}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.note}>{panel.symbol} has no tie clearly above the market average this week.</p>
        )}
        <p className={styles.note}>Correlation of daily returns over the last year, after taking out the whole market.</p>
      </ResearchChapter>
    </>
  )
}
