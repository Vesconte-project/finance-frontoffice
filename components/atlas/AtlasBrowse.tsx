'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { AtlasBundle, AtlasLens, AtlasZone } from '@/lib/atlas-model'
import { browseRegions, linkText, topLinks, type RegionChange, type RegionSort } from '@/lib/atlas-panels'
import { cohesionChart, type AtlasGroup, type ProFeature } from '@/lib/atlas-pro'
import type { AtlasWeeks } from '@/lib/atlas-pro-model'
import { zoneColor } from './atlas-canvas'
import { formatCap } from './atlas-format'
import type { Remote } from './use-atlas-json'
import base from './AtlasExplorer.module.css'
import styles from './AtlasPro.module.css'

export type BrowseTab = 'regions' | 'links' | 'groups' | 'market'
const TABS: Array<[BrowseTab, string]> = [['regions', 'Regions'], ['links', 'Links'], ['groups', 'Groups'], ['market', 'Market']]

type Props = {
  tab: BrowseTab
  onTab: (tab: BrowseTab) => void
  zones: AtlasZone[]
  bundles: AtlasBundle[]
  leadersOf: (zone: AtlasZone) => string[]
  dots: ReadonlyMap<string, number>
  /** Pro: companies in and out over six months; null for readers without it. */
  changes: ReadonlyMap<string, RegionChange> | null
  hues: ReadonlyMap<string, number>
  dark: boolean
  selectedZone: string | null
  onZone: (zone: AtlasZone) => void
  onCompany: (symbol: string) => void
  onHoverZone: (zoneId: string | null) => void
  signedIn: boolean
  pro: boolean
  groups: AtlasGroup[]
  onGroup: (group: AtlasGroup) => void
  onDeleteGroup: (group: AtlasGroup) => void
  accuracy: string | null
  weeks: Remote<AtlasWeeks>
  lens: AtlasLens
  onLocked: (feature: ProFeature, anchor: HTMLElement) => void
}

/** The cohesion sparkline (pro-spec §5d), or why it is empty. */
function Cohesion({ weeks, lens }: { weeks: Remote<AtlasWeeks>; lens: AtlasLens }) {
  if (lens !== 'residual') return <p className={styles.empty}>Shown with the &quot;Beyond the market&quot; view.</p>
  if (weeks.status === 'loading' || weeks.status === 'idle') return <p className={styles.muted} role="status">Loading…</p>
  const chart = weeks.status === 'ok' ? cohesionChart(weeks.data.cohesion.map((point) => point.value)) : null
  if (!chart) return <p className={styles.empty}>Needs a year of weekly maps.</p>
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

/** Browse the market: regions, the reader's saved groups, and the market as a whole. */
export default function AtlasBrowse(props: Props) {
  const id = useId()
  const tabs = useRef(new Map<BrowseTab, HTMLButtonElement | null>())
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    const [next] = TABS[(index + step + TABS.length) % TABS.length]
    props.onTab(next)
    tabs.current.get(next)?.focus()
    event.preventDefault()
  }
  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Browse by">
        {TABS.map(([tab, label], index) => (
          <button
            key={tab}
            ref={(element) => { tabs.current.set(tab, element) }}
            type="button"
            role="tab"
            id={`${id}-${tab}-tab`}
            aria-selected={props.tab === tab}
            aria-controls={`${id}-${tab}`}
            tabIndex={props.tab === tab ? 0 : -1}
            onClick={() => props.onTab(tab)}
            onKeyDown={(event) => onTabKey(event, index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-${props.tab}`} aria-labelledby={`${id}-${props.tab}-tab`}>
        {props.tab === 'regions' ? <Regions {...props} /> : null}
        {props.tab === 'links' ? <Links {...props} /> : null}
        {props.tab === 'groups' ? (
          props.pro ? (
            props.groups.length ? (
              <ul className={styles.rows}>
                {props.groups.map((group) => (
                  <li key={group.id} className={styles.row}>
                    <b>{group.name}</b>
                    <span className={styles.rowActions}>
                      <button type="button" onClick={() => props.onGroup(group)} aria-label={`Select ${group.name}`}>Select</button>
                      <button type="button" onClick={() => props.onDeleteGroup(group)} aria-label={`Delete ${group.name}`}>Delete</button>
                    </span>
                    <small>{group.members.length} companies · {group.members.slice(0, 6).join(' · ')}{group.members.length > 6 ? ' …' : ''}</small>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.empty}>No groups yet. Select companies with the selection tool and save them.</p>
          ) : (
            <button type="button" className={`${styles.empty} ${styles.lockedNote}`} onClick={(event) => props.onLocked('groups', event.currentTarget)}>
              Groups are a Pro tool.
            </button>
          )
        ) : null}
        {props.tab === 'market' ? (
          <>
            <h3 className={base.eyebrow}>Map accuracy</h3>
            {props.accuracy ? (
              <p className={styles.metric}><b>{props.accuracy}</b> of each company&apos;s 10 strongest relationships are, on average, among its 10 nearest neighbours on the map.</p>
            ) : <p className={styles.muted}>{props.signedIn ? 'Not measured for this week.' : 'Shown with a free account.'}</p>}
            <h3 className={base.eyebrow}>Market cohesion, last year {props.pro ? null : <span className={styles.proTag}>Pro</span>}</h3>
            {props.pro ? <Cohesion weeks={props.weeks} lens={props.lens} /> : (
              <button type="button" className={`${styles.empty} ${styles.lockedNote}`} onClick={(event) => props.onLocked('cohesion', event.currentTarget)}>
                Average correlation across the market, week by week, over the last year.
              </button>
            )}
          </>
        ) : null}
      </div>
    </>
  )
}

function Dots({ value }: { value: number }) {
  return (
    <span className={styles.dots} title="How tightly its companies move together, against the other regions" aria-label={`Moves together: ${value} of 5`} role="img">
      {[1, 2, 3, 4, 5].map((dot) => <b key={dot} className={dot <= value ? styles.on : undefined} />)}
    </span>
  )
}

/** Browse › Regions (v27): filter, sort, cohesion dots, market value, six-month changes for Pro, four lead tickers. */
function Regions(props: Props) {
  const [term, setTerm] = useState('')
  const [sort, setSort] = useState<RegionSort>('size')
  const signedIn = props.signedIn
  const rows = browseRegions(props.zones, props.leadersOf, { term, sort: props.changes || sort !== 'change' ? sort : 'size', dots: props.dots, changes: props.changes })
  return (
    <>
      <div className={styles.browseTools}>
        <input type="search" placeholder="Filter regions or tickers" aria-label="Filter regions or tickers" value={term} onChange={(event) => setTerm(event.target.value)} />
        {signedIn ? (
          <label className={styles.sort}>
            <span>Sort</span>
            <select aria-label="Sort regions" value={sort} onChange={(event) => setSort(event.target.value as RegionSort)}>
              <option value="size">Most companies</option>
              <option value="value">Market value</option>
              <option value="tight">Moves most together</option>
              {props.changes ? <option value="change">Changed most (6 mo)</option> : null}
            </select>
          </label>
        ) : null}
      </div>
      {signedIn && props.dots.size ? (
        <p className={styles.browseKey}>
          <Dots value={3} /> how tightly its companies move together · market value{props.changes ? <> · <span className={styles.up}>+in</span> / <span className={styles.down}>−out</span> in 6 months</> : null}
        </p>
      ) : null}
      {rows.length ? (
        <ul className={styles.regionList} onPointerLeave={() => props.onHoverZone(null)}>
          {rows.map(({ zone, leaders, dots, change }) => {
            const cap = formatCap(zone.totalMarketCap)
            return (
              <li key={zone.zoneId} onPointerEnter={() => props.onHoverZone(zone.zoneId)}>
                <button type="button" className={styles.regionRow} aria-pressed={props.selectedZone === zone.zoneId} onClick={() => props.onZone(zone)} onFocus={() => props.onHoverZone(zone.zoneId)} onBlur={() => props.onHoverZone(null)}>
                  <i style={{ background: zoneColor(props.hues.get(zone.zoneId) ?? 200, props.dark) }} aria-hidden="true" />
                  <span className={styles.regionName}>{zone.label.replace(/_/g, ' ')}</span>
                  <span className={styles.regionCount}>{zone.memberCount}<span className={styles.visuallyHidden}> companies</span></span>
                  {dots !== null || cap || (change && (change.joined || change.left)) ? (
                    <small className={styles.regionMeta}>
                      {dots !== null ? <Dots value={dots} /> : null}
                      {cap ? <span>{cap}</span> : null}
                      {change && (change.joined || change.left) ? (
                        <span className={change.joined >= change.left ? styles.up : styles.down} title="Companies that moved in or out in the last six months">+{change.joined} / −{change.left}</span>
                      ) : null}
                    </small>
                  ) : null}
                </button>
                {leaders.length ? (
                  <ul className={styles.regionLeaders} aria-label={`Lead companies in ${zone.label}`}>
                    {leaders.map((symbol) => (
                      <li key={symbol}><button type="button" onClick={() => props.onCompany(symbol)}>{symbol}</button></li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : <p className={styles.muted}>No region matches.</p>}
    </>
  )
}

/** Browse › Links (v27): the region pairs with the most strong ties; selecting one shows its bundle. */
function Links(props: Props) {
  const links = topLinks(props.bundles)
  const zones = new Map(props.zones.map((zone) => [zone.zoneId, zone]))
  const max = links[0]?.tieCount ?? 1
  return (
    <>
      <p className={styles.muted}>The strongest links between regions: how many strong ties join them and how strong they are on average. Select one to see its bundle.</p>
      {links.length ? (
        <ul className={styles.linkList} onPointerLeave={() => props.onHoverZone(null)}>
          {links.map((bundle) => {
            const a = zones.get(bundle.zoneA)
            const b = zones.get(bundle.zoneB)
            if (!a || !b) return null
            // the larger region is selected: its five strongest bundles include this one
            const focus = a.memberCount >= b.memberCount ? a : b
            const name = (zone: AtlasZone) => (
              <span className={styles.linkName}><i style={{ background: zoneColor(props.hues.get(zone.zoneId) ?? 200, props.dark) }} aria-hidden="true" />{zone.label.replace(/_/g, ' ')}</span>
            )
            return (
              <li key={`${bundle.zoneA}|${bundle.zoneB}`} onPointerEnter={() => props.onHoverZone(focus.zoneId)}>
                <button type="button" className={styles.linkRow} onClick={() => props.onZone(focus)} aria-label={`${a.label} and ${b.label}: ${linkText(bundle.tieCount, bundle.meanCorrelation)}`}>
                  <span className={styles.linkPair}>{name(a)}<span aria-hidden="true">↔</span>{name(b)}</span>
                  <span className={styles.linkCount}>{linkText(bundle.tieCount, bundle.meanCorrelation)}</span>
                  <span className={styles.bar} aria-hidden="true"><b style={{ width: `${Math.round((bundle.tieCount / max) * 100)}%` }} /></span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : <p className={styles.empty}>No ties between regions this week.</p>}
    </>
  )
}
