import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Lock } from 'lucide-react'
import ResearchChapter, { ChapterCard } from '@/components/stocks/research/ResearchChapter'
import { buttonClass } from '@/components/ui/Button'
import type { AtlasCompanyPanel } from '@/lib/atlas-model'
import RelationshipOrbit from './RelationshipOrbit'
import { OrbitFocusProvider, OrbitReading, type OrbitZone } from './OrbitFocus'
import styles from './CompanyAtlasPlace.module.css'

function formatWeek(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const readable = (label: string) => label.replace(/_/g, ' ')

/** Silhouette rows under the locked offer: built from nothing, they only say that more exist. */
const SILHOUETTE = [0.82, 0.64, 0.71]

/**
 * A company on the weekly atlas: the region it belongs to and the companies it
 * moves with most once the whole market is taken out, drawn as an orbit in the
 * atlas's colours and listed by strength. A reader without an account sees the
 * strongest five ties; the rest are shown locked, never guessed.
 */
export default function CompanyAtlasPlace({
  panel,
  hues,
}: {
  panel: AtlasCompanyPanel
  /** Atlas colour per region id, the same the market atlas gives it. */
  hues: Record<string, number>
}) {
  const region = readable(panel.zoneLabel ?? panel.zoneId)
  const ties = [...panel.neighbours].sort((a, b) => b.correlation - a.correlation || a.symbol.localeCompare(b.symbol))
  const hidden = Math.max(0, panel.neighbourCount - ties.length)
  const back = `/stocks/${encodeURIComponent(panel.symbol)}/relationships`
  const signUpHref = `/sign-up?redirect_url=${encodeURIComponent(back)}`
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(back)}`

  const zones: Record<string, OrbitZone> = {}
  const name = (zoneId: string, label: string | null | undefined) => {
    if (!zones[zoneId] || (label && zones[zoneId].label === zoneId)) zones[zoneId] = { label: label ?? zoneId, hue: hues[zoneId] ?? -1 }
  }
  name(panel.zoneId, panel.zoneLabel)
  for (const membership of panel.memberships) name(membership.zoneId, membership.label)
  for (const tie of ties) if (tie.zoneId) name(tie.zoneId, null)
  // Without the atlas's colours, regions still get distinct hues by the same golden-angle rule.
  const local = new Map(Object.keys(zones).sort().map((zoneId, index) => [zoneId, Math.round((index * 137.508 + 18) % 360)]))
  for (const [zoneId, zone] of Object.entries(zones)) if (zone.hue < 0) zone.hue = local.get(zoneId) ?? 210
  const zoneOrder = panel.memberships.map((membership) => membership.zoneId)
  const swatch = (zoneId: string | null) => ({ '--h': zoneId ? zones[zoneId]?.hue ?? 210 : 210 }) as CSSProperties

  const orbitTies = ties.map((tie) => ({ symbol: tie.symbol, name: tie.name, zoneId: tie.zoneId, correlation: tie.correlation }))
  const drawn = ties.length > 0 || hidden > 0

  return (
    <>
      <OrbitFocusProvider symbol={panel.symbol} zoneId={panel.zoneId} zones={zones} ties={orbitTies}>
        <ResearchChapter
          id="atlas-region"
          label="Where it sits"
          actions={<Link href="/markets/network" className={styles.link}>Open the atlas →</Link>}
          aside={panel.memberships.length || drawn ? (
            <>
              {panel.memberships.length ? (
                <ChapterCard title="Where its ties land">
                  <p className={styles.cardLead}>The regions of the companies {panel.symbol} moves with, by share of its strongest ties.</p>
                  <ul className={styles.shares} aria-label={`How ${panel.symbol}'s strongest ties split between regions`}>
                    {panel.memberships.map((membership) => (
                      <li key={membership.zoneId} style={swatch(membership.zoneId)} data-own={membership.zoneId === panel.zoneId ? 'true' : undefined}>
                        <span className={styles.zoneName}>
                          <i className={styles.swatch} aria-hidden="true" />
                          <span>{readable(membership.label ?? membership.zoneId)}</span>
                          {membership.zoneId === panel.zoneId ? <em className={styles.ownTag}>{panel.symbol}&rsquo;s region</em> : null}
                        </span>
                        <span className={styles.bar} aria-hidden="true"><span style={{ width: `${Math.round(membership.share * 100)}%` }} /></span>
                        <strong>{Math.round(membership.share * 100)}%</strong>
                      </li>
                    ))}
                  </ul>
                </ChapterCard>
              ) : null}
              {drawn ? <OrbitReading variant="aside" /> : null}
            </>
          ) : undefined}
        >
          <dl className={styles.facts} data-atlas-facts="">
            <div className={styles.fact} style={swatch(panel.zoneId)} data-own="true">
              <dt>{panel.symbol}&rsquo;s region</dt>
              <dd><i className={styles.swatch} aria-hidden="true" />{region}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Atlas week</dt>
              <dd>{formatWeek(panel.asOf)}</dd>
            </div>
          </dl>
          {drawn ? (
            <RelationshipOrbit zoneOrder={zoneOrder} hidden={hidden} signUpHref={signUpHref} signInHref={signInHref} />
          ) : null}
        </ResearchChapter>
      </OrbitFocusProvider>
      <ResearchChapter id="related-companies" label="Moves most with" band>
        {ties.length ? (
          <ol className={styles.neighbours} aria-label={`Companies that move most with ${panel.symbol}`}>
            {ties.map((neighbour) => (
              <li key={neighbour.symbol} style={swatch(neighbour.zoneId)}>
                <Link prefetch={false} href={`/stocks/${encodeURIComponent(neighbour.symbol)}/relationships`}>
                  <i className={styles.swatch} aria-hidden="true" />
                  <b>{neighbour.symbol}</b>
                  {neighbour.name ? <span>{neighbour.name}</span> : null}
                </Link>
                <span className={styles.region}>{neighbour.zoneId ? readable(zones[neighbour.zoneId]?.label ?? neighbour.zoneId) : null}</span>
                <span className={styles.bar} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(1, neighbour.correlation)) * 100}%` }} /></span>
                <strong aria-label={`Correlation ${neighbour.correlation.toFixed(2)}`}>{neighbour.correlation.toFixed(2)}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.note}>{panel.symbol} has no tie clearly above the market average this week.</p>
        )}
        {hidden > 0 ? (
          <div className={styles.locked} data-relationships-locked="">
            <div className={styles.silhouette} aria-hidden="true">
              {SILHOUETTE.map((width, index) => (
                <span key={index}><i /><i style={{ width: `${width * 100}%` }} /><i /></span>
              ))}
            </div>
            <div className={styles.offer}>
              <p className={styles.offerTitle}><Lock size={15} strokeWidth={2.2} aria-hidden="true" /> {hidden} more {hidden === 1 ? 'company moves' : 'companies move'} with {panel.symbol}</p>
              <p className={styles.offerText}>Create a free account to see every tie and where each company sits on the atlas.</p>
              <div className={styles.offerActions}>
                <Link href={signUpHref} className={buttonClass({ variant: 'primary', size: 'sm' })}>Create a free account</Link>
                <Link href={signInHref} className={buttonClass({ variant: 'ghost', size: 'sm' })}>Sign in</Link>
              </div>
            </div>
          </div>
        ) : null}
        <p className={styles.note}>
          Correlation of daily returns over the last year, after taking out the whole market.
        </p>
      </ResearchChapter>
    </>
  )
}
