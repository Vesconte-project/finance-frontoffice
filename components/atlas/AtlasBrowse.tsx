'use client'

import { useId, useRef, type KeyboardEvent } from 'react'
import type { AtlasBundle, AtlasNode, AtlasZone } from '@/lib/atlas-model'
import { browseRegions, linkText, topLinks, type RegionChange } from '@/lib/atlas-panels'
import type { AtlasGroup, ProFeature } from '@/lib/atlas-pro'
import { zoneColor } from './atlas-canvas'
import { formatCap } from './atlas-format'
import styles from './AtlasPro.module.css'

export type BrowseTab = 'regions' | 'links' | 'groups'
const TABS: Array<[BrowseTab, string]> = [['regions', 'Regions'], ['links', 'Links'], ['groups', 'Groups']]

type Props = {
  /** The order the map sizes regions by: companies, or market value when Pro sizes them by value. */
  order: 'size' | 'value'
  /** The companies most others move with, beyond the market: the deepest wells. Empty signed out. */
  hubs: AtlasNode[]
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
  onLocked: (feature: ProFeature, anchor: HTMLElement) => void
}

/** Browse the market: its regions (the legend), the links between them, and the reader's saved groups. */
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

/**
 * Browse › Regions: the map's legend. One order, the one the map draws with: regions are listed as
 * large as they are drawn (by companies, or by market value when Pro sizes them by value), so the
 * first row is the largest patch on screen.
 */
function Regions(props: Props) {
  const rows = browseRegions(props.zones, props.leadersOf, { sort: props.order, dots: props.dots, changes: props.changes })
  if (!rows.length) return <p className={styles.muted}>No regions this week.</p>
  return (
    <>
      {props.hubs.length ? (
        <div className={styles.hubs}>
          <h3 title="The companies the most others move with, beyond the market: the deepest wells on the map">Most connected</h3>
          <ul aria-label="Most connected companies">
            {props.hubs.map((node) => (
              <li key={node.symbol}><button type="button" onClick={() => props.onCompany(node.symbol)} title={node.name ?? undefined}>{node.symbol}</button></li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className={styles.regionList} onPointerLeave={() => props.onHoverZone(null)}>
        {rows.map(({ zone, leaders, dots, change }) => {
          const cap = formatCap(zone.totalMarketCap)
          return (
            <li key={zone.zoneId} onPointerEnter={() => props.onHoverZone(zone.zoneId)}>
              <button type="button" className={styles.regionRow} aria-pressed={props.selectedZone === zone.zoneId} onClick={() => props.onZone(zone)} onFocus={() => props.onHoverZone(zone.zoneId)} onBlur={() => props.onHoverZone(null)}>
                <i style={{ background: zoneColor(props.hues.get(zone.zoneId) ?? 200, props.dark) }} aria-hidden="true" />
                <span className={styles.regionName}>{zone.label.replace(/_/g, ' ')}</span>
                <span className={styles.regionCount}>{props.order === 'value' && cap ? cap : zone.memberCount}<span className={styles.visuallyHidden}>{props.order === 'value' && cap ? ' market value' : ' companies'}</span></span>
              </button>
              <div className={styles.regionMeta}>
                {dots !== null ? <Dots value={dots} /> : null}
                {props.order !== 'value' && cap ? <span>{cap}</span> : null}
                {change && (change.joined || change.left) ? (
                  <span className={change.joined >= change.left ? styles.up : styles.down} title="Companies that moved in or out in the last six months">+{change.joined} / −{change.left}</span>
                ) : null}
                {leaders.length ? (
                  <ul className={styles.regionLeaders} aria-label={`Lead companies in ${zone.label}`}>
                    {leaders.map((symbol) => (
                      <li key={symbol}><button type="button" onClick={() => props.onCompany(symbol)}>{symbol}</button></li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      {props.signedIn && props.dots.size ? (
        <p className={styles.browseKey}>
          <Dots value={3} /> moves together{props.changes ? <> · <span className={styles.up}>+in</span> / <span className={styles.down}>−out</span>, 6 mo</> : null}
        </p>
      ) : null}
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
