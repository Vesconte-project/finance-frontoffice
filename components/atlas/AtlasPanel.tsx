'use client'

import Link from 'next/link'
import type { AtlasCompanyPanel, AtlasDenial, AtlasZone, AtlasZonePanel } from '@/lib/atlas-model'
import type { ProFeature, ThenAndNow } from '@/lib/atlas-pro'
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
}

function CompanyLinks({ items }: { items: Array<{ symbol: string; name: string | null }> }) {
  return (
    <ul className={base.refs}>
      {items.map((item) => (
        <li key={item.symbol}>
          <Link href={`/stocks/${encodeURIComponent(item.symbol)}`}><b>{item.symbol}</b>{item.name ? ` ${item.name}` : ''}</Link>
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

export default function AtlasPanel({ panel, zonesById, onRetry, pro, then, farTies, onAction, onCompany }: Props) {
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
    return (
      <div>
        <p className={base.eyebrow}>Region</p>
        <h2 className={base.panelTitle}>{zone.label}</h2>
        <p className={base.muted}>{zone.memberCount} companies whose prices move together beyond the market.</p>
        {signedOut ? null : <Actions kind="zone" pro={pro} onAction={onAction} />}
        <h3 className={base.panelHeading}>{signedOut ? 'Largest companies' : 'Leading companies'}</h3>
        <CompanyLinks items={zone.leaders} />
        {zone.members.length ? (
          <>
            <h3 className={base.panelHeading}>All {zone.members.length} companies</h3>
            <ul className={base.refs}>
              {zone.members.map((member) => (
                <li key={member.symbol}>
                  <Link href={`/stocks/${encodeURIComponent(member.symbol)}`}><b>{member.symbol}</b>{member.name ? ` ${member.name}` : ''}</Link>
                  {member.share !== null ? <span className={base.share}>{Math.round(member.share * 100)}% here</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {signedOut ? <Link className={base.cta} href={SIGN_UP_HREF}>See every company in this region</Link> : null}
      </div>
    )
  }
  const company = panel.data
  const signedOut = company.access.tier === 'signedOut'
  const cap = formatCap(company.marketCap)
  const accuracy = company.fidelity === null ? null : Math.round(company.fidelity * 10)
  const residual = company.lens === 'residual'
  const totals = residual && company.neighbours.some((neighbour) => neighbour.total !== null)
  return (
    <div>
      <p className={base.eyebrow}>{company.symbol}</p>
      <h2 className={base.panelTitle}>{company.name ?? company.symbol}</h2>
      <p className={base.muted}>
        {[company.sector, company.industry, company.country, cap].filter(Boolean).join(' · ')}
      </p>
      <p>In <b>{company.zoneLabel ?? zonesById.get(company.zoneId)?.label ?? 'its region'}</b></p>
      {company.themes.length ? (
        <p className={styles.themeLine}>
          Thematic funds group it as {company.themes.map((theme, index) => (
            <span key={theme.themeId}>{index ? ', ' : ''}<b>{theme.label}</b></span>
          ))}. The two can differ: one is how it trades, the other how it is labelled.
        </p>
      ) : null}
      {signedOut ? null : <Actions kind="company" pro={pro} onAction={onAction} />}
      {accuracy !== null ? (
        <div className={styles.metricBlock}>
          <p className={styles.metric}>Map accuracy here: <b>{accuracy} of 10</b></p>
          <p className={base.muted}>
            {accuracy} of its 10 strongest relationships sit among its 10 nearest neighbours on the map.{pro && farTies > 0 ? ' The others are drawn as dashed red lines.' : ''}
          </p>
        </div>
      ) : null}
      {then ? <ThenNow then={then} onCompany={onCompany} /> : null}
      {company.memberships.length > 1 ? (
        <>
          <h3 className={base.panelHeading}>Where its ties are</h3>
          <ul className={base.refs}>
            {company.memberships.map((membership) => (
              <li key={membership.zoneId}>{membership.label ?? membership.zoneId} <span className={base.share}>{Math.round(membership.share * 100)}%</span></li>
            ))}
          </ul>
        </>
      ) : null}
      {company.neighbours.length ? (
        <>
          <h3 className={base.panelHeading}>Moves most with {totals ? <small className={styles.headingNote}>beyond market · total</small> : residual ? null : <small className={styles.headingNote}>total</small>}</h3>
          <ul className={base.refs}>
            {company.neighbours.slice(0, 10).map((neighbour) => (
              <li key={neighbour.symbol}>
                <Link href={`/stocks/${encodeURIComponent(neighbour.symbol)}`}><b>{neighbour.symbol}</b>{neighbour.name ? ` ${neighbour.name}` : ''}</Link>
                <span className={base.share}>
                  {strength(neighbour.correlation)}
                  {signedOut ? null : <small className={styles.tieNumbers}> {neighbour.correlation.toFixed(2)}{totals && neighbour.total !== null ? ` · ${neighbour.total.toFixed(2)}` : ''}</small>}
                  {neighbour.trend === 'stronger' ? <em className={`${styles.trend} ${styles.up}`} title="Stronger in the last six months than in the six before"> · ↑ stronger</em> : null}
                  {neighbour.trend === 'weaker' ? <em className={`${styles.trend} ${styles.down}`} title="Weaker in the last six months than in the six before"> · ↓ weaker</em> : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {signedOut ? (
        <>
          <h3 className={base.panelHeading}>Largest companies in this region</h3>
          <CompanyLinks items={company.zoneLeaders} />
          <Link className={base.cta} href={SIGN_UP_HREF}>See what {company.symbol} moves with</Link>
        </>
      ) : null}
      <Link className={base.more} href={`/stocks/${encodeURIComponent(company.symbol)}`}>Open {company.symbol}</Link>
    </div>
  )
}
