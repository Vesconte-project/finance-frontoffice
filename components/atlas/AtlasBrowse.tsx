'use client'

import { useId, useRef, type KeyboardEvent } from 'react'
import type { AtlasLens, AtlasNode, AtlasZone } from '@/lib/atlas-model'
import { cohesionChart, type AtlasGroup, type ProFeature } from '@/lib/atlas-pro'
import type { AtlasWeeks } from '@/lib/atlas-pro-model'
import { zoneColor } from './atlas-canvas'
import type { Remote } from './use-atlas-json'
import base from './AtlasExplorer.module.css'
import styles from './AtlasPro.module.css'

export type BrowseTab = 'regions' | 'groups' | 'market'
const TABS: Array<[BrowseTab, string]> = [['regions', 'Regions'], ['groups', 'Groups'], ['market', 'Market']]

type Props = {
  tab: BrowseTab
  onTab: (tab: BrowseTab) => void
  regions: Array<{ zone: AtlasZone; nodes: AtlasNode[] }>
  hues: ReadonlyMap<string, number>
  onZone: (zone: AtlasZone) => void
  onCompany: (node: AtlasNode) => void
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
        {props.tab === 'regions' ? (
          <ul className={base.browse}>
            {props.regions.map(({ zone, nodes }) => (
              <li key={zone.zoneId}>
                <button type="button" className={base.zoneButton} onClick={() => props.onZone(zone)}>
                  <i style={{ background: zoneColor(props.hues.get(zone.zoneId) ?? 200, false) }} aria-hidden="true" />
                  {zone.label} <span>{zone.memberCount} companies</span>
                </button>
                {nodes.length ? (
                  <ul className={base.companies}>
                    {nodes.map((node) => (
                      <li key={node.symbol}>
                        <button type="button" onClick={() => props.onCompany(node)}>{node.symbol}</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
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
