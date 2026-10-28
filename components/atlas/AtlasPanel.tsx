'use client'

import Link from 'next/link'
import type { AtlasCompanyPanel, AtlasDenial, AtlasZone, AtlasZonePanel } from '@/lib/atlas-model'
import { betweenRegions, coverageOf, linkText, movesWithOthers, namingNote, percent } from '@/lib/atlas-panels'
import type { ProFeature, ThenAndNow } from '@/lib/atlas-pro'
import { zoneColor } from './atlas-canvas'
import { SIGN_UP_HREF, formatCap, strength } from './atlas-format'
import base from './AtlasExplorer.module.css'
import styles from './AtlasPro.module.css'

export type PanelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'company'; data: AtlasCompanyPanel }
  | { status: 'zone'; data: AtlasZonePanel }
  | { status: 'denied'; reason: AtlasDenial }
  | { status: 'error' }

export type PanelAction = 'add' | 'compare' | 'test' | 'note'

type Props = {
  panel: PanelState
  zonesById: Map<string, AtlasZone>
  onRetry: () => void
  pro: boolean
  /** Pro: the company's move against an earlier week, when the movement has loaded. */
  then: ThenAndNow | null
  /** Pro and drawn on the map: how many of its strong ties are dashed red lines. */
  farTies: number
  onAction: (action: PanelAction, feature: ProFeature, anchor: HTMLElement) => void
  onCompany: (symbol: string) => void
  onZone: (zoneId: string) => void
  hues: ReadonlyMap<string, number>
  dark: boolean
  /** The largest reach on the map, for "Moves with others". */
  maxReach: number | null
}

/** A labelled bar: a share of something, coloured by region. */
function ShareBar({ label, value, width, color, onClick }: { label: string; value: string; width: number; color: string; onClick?: () => void }) {
  const body = (
    <>
      <span className={styles.shareHead}><span>{label}</span><small>{value}</small></span>
      <span className={styles.bar} aria-hidden="true"><b style={{ width: `${Math.round(Math.max(0, Math.min(1, width)) * 100)}%`, background: color }} /></span>
    </>
  )
  return onClick ? <button type="button" className={styles.share} onClick={onClick}>{body}</button> : <div className={styles.share}>{body}</div>
}

function SectionLabel({ title, note }: { title: string; note?: string }) {
  return <h3 className={base.panelHeading}>{title}{note ? <small className={styles.headingNote}>{note}</small> : null}</h3>
}

function CompanyLinks({ items }: { items: Array<{ symbol: string; name: string | null }> }) {
  return (
    <ul className={base.refs}>
      {items.map((item) => (
        <li key={item.symbol}>
          <Link prefetch={false} href={`/stocks/${encodeURIComponent(item.symbol)}`}><b>{item.symbol}</b>{item.name ? ` ${item.name}` : ''}</Link>
        </li>
      ))}
    </ul>
  )
}

/** The tools that attach to what the panel shows (pro-spec §7); locked with a dot for readers without Pro. */
function Actions({ kind, pro, onAction }: { kind: 'company' | 'zone'; pro: boolean; onAction: Props['onAction'] }) {
  const items: Array<[PanelAction, string, ProFeature]> = [
    ['add', kind === 'company' ? '+ Selection' : 'Select all', 'select'],
    ['compare', 'Compare', 'compare'],
    ['test', 'Test link', 'test'],
    ['note', 'Note', 'notebook'],
  ]
  return (
    <div className={styles.actions} role="group" aria-label="Tools">
      {items.map(([action, label, feature]) => (
        <button key={action} type="button" data-locked={pro ? undefined : ''} aria-label={pro ? undefined : `${label}: Pro`} onClick={(event) => onAction(action, feature, event.currentTarget)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Peers({ symbols, onCompany }: { symbols: string[]; onCompany: (symbol: string) => void }) {
  return (
    <>
      {symbols.map((symbol, index) => (
        <span key={symbol}>
          {index ? ' ' : ''}
          <button type="button" className={styles.peer} onClick={() => onCompany(symbol)}>{symbol}</button>
        </span>
      ))}
    </>
  )
}

function ThenNow({ then, onCompany }: { then: ThenAndNow; onCompany: (symbol: string) => void }) {
  return (
    <section aria-label="Then and now">
      <h3 className={base.panelHeading}>Then and now <small className={styles.headingNote}>vs {then.when}</small></h3>
      <div className={then.changed ? `${styles.thenNow} ${styles.changed}` : styles.thenNow}>
        <p className={styles.verdict}>{then.verdict}</p>
        <p>{then.region.map((part, index) => (part.bold ? <b key={index}>{part.text}</b> : <span key={index}>{part.text}</span>))}</p>
        {then.movement ? <p>{then.movement} <small>(every position drifts a little between snapshots)</small></p> : null}
        {then.tiesIn.length ? (
          <>
            <p>New among its 5 strongest ties: <Peers symbols={then.tiesIn} onCompany={onCompany} /></p>
            {then.tiesOut.length ? <p>No longer among them: <Peers symbols={then.tiesOut} onCompany={onCompany} /></p> : null}
          </>
        ) : <p>Same 5 strongest ties</p>}
      </div>
    </section>
  )
}

export default function AtlasPanel({ panel, zonesById, onRetry, pro, then, farTies, onAction, onCompany, onZone, hues, dark, maxReach }: Props) {
  const color = (zoneId: string) => zoneColor(hues.get(zoneId) ?? 200, dark)
  const labelOf = (zoneId: string, fallback?: string | null) => (zonesById.get(zoneId)?.label ?? fallback ?? zoneId).replace(/_/g, ' ')
  if (panel.status === 'idle' || panel.status === 'loading') return <p className={base.muted} role="status">Loading…</p>
  if (panel.status === 'error') {
    return (
      <div>
        <p className={base.muted}>These details could not load.</p>
        <button type="button" className={base.pill} onClick={onRetry}>Retry</button>
      </div>
    )
  }
  if (panel.status === 'denied') {
    return panel.reason === 'sign_in_required' ? (
      <div>
        <h2 className={base.panelTitle}>Sign in to see this</h2>
        <p className={base.muted}>Without an account the atlas shows each region and its largest companies. A free account shows every company, where it really sits and what it moves with.</p>
        <Link className={base.cta} href={SIGN_UP_HREF}>Create a free account</Link>
      </div>
    ) : (
      <div>
        <h2 className={base.panelTitle}>History available on Pro</h2>
        <p className={base.muted}>Earlier weeks and how companies moved between them are part of Pro.</p>
      </div>
    )
  }
  if (panel.status === 'zone') {
    const zone = panel.data
    const signedOut = zone.access.tier === 'signedOut'
    if (signedOut) {
      return (
        <div>
          <p className={base.eyebrow}>Region</p>
          <h2 className={base.panelTitle}>{zone.label}</h2>
          <p className={base.muted}>{zone.memberCount} companies whose prices move together beyond the market.</p>
          <h3 className={base.panelHeading}>Largest companies</h3>
          <CompanyLinks items={zone.leaders} />
          <Link className={base.cta} href={SIGN_UP_HREF}>See every company in this region</Link>
        </div>
      )
    }
    const naming = namingNote(zone.labelSource, zone.label, zone.labelSupport)
    const coverage = coverageOf(zonesById.get(zone.zoneId)?.contour ?? null)
    const links = zone.links.slice(0, 8)
    const maxTies = links[0]?.tieCount ?? 1
    const cap = formatCap(zone.totalMarketCap)
    return (
      <div>
        <p className={base.eyebrow}>Region</p>
        <h2 className={base.panelTitle}>{zone.label.replace(/_/g, ' ')}</h2>
        <div className={styles.chips}>
          <span>{zone.memberCount} companies</span>
          {zone.sharedCount !== null ? <span>{zone.sharedCount} shared with other regions</span> : null}
          {zone.fidelity !== null ? <span>map accuracy {percent(zone.fidelity)}</span> : null}
        </div>
        <Actions kind="zone" pro={pro} onAction={onAction} />
        {naming ? <p className={styles.note}>{naming}</p> : null}
        <p className={styles.note}>A region of the map where companies move together. The line holds {percent(coverage)} of its weight. It names an area; it does not own the companies in it.</p>
        {zone.subIndustries.length ? (
          <>
            <SectionLabel title="Sub-industries" note="companies" />
            <div className={styles.shares}>
              {zone.subIndustries.map((item) => (
                <ShareBar key={item.industry} label={item.industry} value={String(item.count)} width={item.count / Math.max(1, zone.memberCount)} color={color(zone.zoneId)} />
              ))}
            </div>
          </>
        ) : null}
        {links.length ? (
          <>
            <SectionLabel title="Tied to other regions" note="strong ties · average" />
            <div className={styles.shares}>
              {links.map((link) => (
                <ShareBar key={link.zoneId} label={labelOf(link.zoneId)} value={linkText(link.tieCount, link.meanCorrelation).replace(' ties', '')}
                  width={link.tieCount / maxTies} color={color(link.zoneId)} onClick={() => onZone(link.zoneId)} />
              ))}
            </div>
          </>
        ) : null}
        {cap || zone.dominantSector ? (
          <div className={styles.metrics}>
            {cap ? <div className={styles.metricBox}><span>Market value here</span><strong>{cap}</strong></div> : null}
            {zone.dominantSector ? <div className={styles.metricBox}><span>Primary sector</span><strong>{zone.dominantSector}</strong></div> : null}
          </div>
        ) : null}
        {zone.relevant.length ? (
          <>
            <SectionLabel title="Most relevant here" note="by weight in this region" />
            <div className={styles.grid}>
              {zone.relevant.map((item) => (
                <button key={item.symbol} type="button" onClick={() => onCompany(item.symbol)}>
                  <b>{item.symbol}</b><small>{item.name ?? ''}</small>{item.share < 0.95 ? <em>{percent(item.share)} here</em> : null}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {zone.members.length ? (
          <>
            <h3 className={base.panelHeading}>All {zone.members.length} companies</h3>
            <ul className={base.refs}>
              {zone.members.map((member) => (
                <li key={member.symbol}>
                  <Link prefetch={false} href={`/stocks/${encodeURIComponent(member.symbol)}`}><b>{member.symbol}</b>{member.name ? ` ${member.name}` : ''}</Link>
                  {member.share !== null ? <span className={base.share}>{Math.round(member.share * 100)}% here</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    )
  }
  const company = panel.data
  const signedOut = company.access.tier === 'signedOut'
  const cap = formatCap(company.marketCap)
  const accuracy = company.fidelity === null ? null : Math.round(company.fidelity * 10)
  const residual = company.lens === 'residual'
  const totals = residual && company.neighbours.some((neighbour) => neighbour.total !== null)
  if (signedOut) {
    return (
      <div>
        <p className={base.eyebrow}>{company.symbol}</p>
        <h2 className={base.panelTitle}>{company.name ?? company.symbol}</h2>
        <p className={base.muted}>{[company.sector, company.industry, company.country, cap].filter(Boolean).join(' · ')}</p>
        <p>In <b>{company.zoneLabel ?? zonesById.get(company.zoneId)?.label ?? 'its region'}</b></p>
        <h3 className={base.panelHeading}>Largest companies in this region</h3>
        <CompanyLinks items={company.zoneLeaders} />
        <Link className={base.cta} href={SIGN_UP_HREF}>See what {company.symbol} moves with</Link>
        <Link prefetch={false} className={base.more} href={`/stocks/${encodeURIComponent(company.symbol)}`}>Open {company.symbol}</Link>
      </div>
    )
  }
  const reach = movesWithOthers(company.reach, maxReach)
  const metrics: Array<[string, string]> = []
  if (accuracy !== null) metrics.push(['Map accuracy here', `${accuracy} of 10`])
  if (reach) metrics.push(['Moves with others', reach])
  if (cap) metrics.push(['Market value', cap])
  if (company.volatility20d !== null) metrics.push(['20d volatility', percent(company.volatility20d)])
  return (
    <div>
      <p className={base.eyebrow}>{company.symbol}</p>
      <h2 className={base.panelTitle}>{company.name ?? company.symbol}</h2>
      <div className={styles.chips}>
        {company.industry ? <span>{company.industry}</span> : null}
        {company.country ? <span>{company.country}</span> : null}
        {company.loner ? <span>Moves on its own</span> : betweenRegions(company.memberships) ? <span>Between regions</span> : null}
      </div>
      <Actions kind="company" pro={pro} onAction={onAction} />
      <p className={styles.note}>
        On the map: <b>{labelOf(company.zoneId, company.zoneLabel)}</b>, because its price moves with those companies.
        {company.themes.length ? (
          <> Thematic funds group it as {company.themes.map((theme, index) => (
            <span key={theme.themeId}>{index ? ', ' : ''}<b>{theme.label}</b></span>
          ))}. The two can differ: one is how it trades, the other how it is labelled.</>
        ) : null}
      </p>
      {company.memberships.length ? (
        <>
          <SectionLabel title="Where it sits" note="share of its 15 strongest ties" />
          <div className={styles.shares}>
            {company.memberships.map((membership) => (
              <ShareBar key={membership.zoneId} label={labelOf(membership.zoneId, membership.label)} value={percent(membership.share)}
                width={membership.share} color={color(membership.zoneId)} onClick={() => onZone(membership.zoneId)} />
            ))}
          </div>
        </>
      ) : null}
      {metrics.length ? (
        <div className={styles.metrics}>
          {metrics.map(([label, value]) => <div key={label} className={styles.metricBox}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
      ) : null}
      {accuracy !== null ? (
        <p className={styles.note}>
          {accuracy} of its 10 strongest relationships sit among its 10 nearest neighbours on the map.{pro && farTies > 0 ? ' The others are drawn as dashed red lines.' : ''}
        </p>
      ) : null}
      {then ? <ThenNow then={then} onCompany={onCompany} /> : null}
      {company.neighbours.length ? (
        <>
          <h3 className={base.panelHeading}>Strongest relationships {totals ? <small className={styles.headingNote}>beyond market · total</small> : residual ? null : <small className={styles.headingNote}>total</small>}</h3>
          <ul className={base.refs}>
            {company.neighbours.slice(0, 10).map((neighbour) => (
              <li key={neighbour.symbol}>
                <Link prefetch={false} href={`/stocks/${encodeURIComponent(neighbour.symbol)}`}><b>{neighbour.symbol}</b>{neighbour.name ? ` ${neighbour.name}` : ''}</Link>
                <span className={base.share}>
                  {strength(neighbour.correlation)}
                  <small className={styles.tieNumbers}> {neighbour.correlation.toFixed(2)}{totals && neighbour.total !== null ? ` · ${neighbour.total.toFixed(2)}` : ''}</small>
                  {neighbour.trend === 'stronger' ? <em className={`${styles.trend} ${styles.up}`} title="Stronger in the last six months than in the six before"> · ↑ stronger</em> : null}
                  {neighbour.trend === 'weaker' ? <em className={`${styles.trend} ${styles.down}`} title="Weaker in the last six months than in the six before"> · ↓ weaker</em> : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Link prefetch={false} className={base.more} href={`/stocks/${encodeURIComponent(company.symbol)}`}>Open {company.symbol}</Link>
    </div>
  )
}
