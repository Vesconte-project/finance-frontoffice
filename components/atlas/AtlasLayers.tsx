'use client'

import type { ReactNode } from 'react'
import SegmentedControl from '@/components/ui/SegmentedControl'
import type { AtlasLens } from '@/lib/atlas-model'
import type { ProFeature } from '@/lib/atlas-pro'
import type { AtlasInfluence } from '@/lib/atlas-pro-model'
import { SymbolGlyph, type AtlasSymbol } from './atlas-symbols'
import type { Remote } from './use-atlas-json'
import styles from './AtlasPro.module.css'

type Props = {
  pro: boolean
  lens: AtlasLens
  byValue: boolean
  showFidelity: boolean
  showInfluence: boolean
  influence: Remote<AtlasInfluence>
  onLens: (lens: AtlasLens) => void
  onByValue: (value: boolean) => void
  onFidelity: (value: boolean) => void
  onInfluence: (value: boolean) => void
  onLocked: (feature: ProFeature, anchor: HTMLElement) => void
}

/** A locked row answers any press with the upsell, and its controls do nothing. */
function Row({ feature, pro, onLocked, children }: { feature: ProFeature; pro: boolean; onLocked: Props['onLocked']; children: ReactNode }) {
  return (
    <div
      className={pro ? styles.layerRow : `${styles.layerRow} ${styles.locked}`}
      onPointerDownCapture={pro ? undefined : (event) => event.stopPropagation()}
      onClickCapture={pro ? undefined : (event) => {
        event.preventDefault()
        event.stopPropagation()
        onLocked(feature, event.target instanceof HTMLElement ? event.target : event.currentTarget)
      }}
    >
      {children}
    </div>
  )
}

function ProTag({ pro }: { pro: boolean }) {
  return pro ? null : <span className={styles.proTag}>Pro</span>
}

const LENSES = ['residual', 'total'] as const
const LENS_DETAILS = { residual: { label: 'Beyond the market' }, total: { label: 'Total co-movement' } }
const REGION_SIZES = ['companies', 'value'] as const
const REGION_SIZE_DETAILS = { companies: { label: 'Companies' }, value: { label: 'Market value' } }

/** A map setting: its name and meaning, and a choice between two ways of drawing. */
function Mode<T extends string>({ title, hint, options, optionDetails, value, onChange, pro }: {
  title: string
  hint: string
  options: readonly T[]
  optionDetails: Record<T, { label: string }>
  value: T
  onChange: (value: T) => void
  pro: boolean
}) {
  return (
    <>
      <div className={styles.layerText}>
        <b>{title} <ProTag pro={pro} /></b>
        <small>{hint}</small>
      </div>
      <SegmentedControl
        options={options}
        optionDetails={optionDetails}
        value={value}
        onChange={onChange}
        ariaLabel={pro ? title : `${title}: Pro`}
        fill
      />
    </>
  )
}

/** An overlay: its symbol, name and meaning, and a switch. */
function Overlay({ symbol, title, hint, checked, disabled, onChange, pro }: { symbol: AtlasSymbol; title: string; hint: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void; pro: boolean }) {
  return (
    <label className={styles.overlay}>
      <span className={styles.overlayGlyph}><SymbolGlyph symbol={symbol} width={28} height={19} /></span>
      <span className={styles.layerText}>
        <b>{title} <ProTag pro={pro} /></b>
        <small>{hint}</small>
      </span>
      <input type="checkbox" role="switch" className={styles.switch} aria-label={title} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

/** What the influence test found, under its switch; a locked feature carries no data. */
function InfluenceList({ influence, lens }: { influence: Remote<AtlasInfluence>; lens: AtlasLens }) {
  if (lens !== 'residual') return <p className={styles.layerNote}>Shown with the &quot;Beyond the market&quot; view.</p>
  if (influence.status === 'loading') return <p className={styles.layerNote} role="status">Loading…</p>
  if (influence.status !== 'ok') return influence.status === 'idle' ? null : <p className={styles.layerNote}>The influence test could not load.</p>
  const data = influence.data
  if (!data.tested) return <p className={styles.layerNote}>{data.reason === 'no_report_dates' ? 'Needs report dates for these companies.' : 'Needs two years of history.'}</p>
  if (!data.arrows.length) return <p className={styles.layerNote}>No influence between groups passes the test this week.</p>
  return (
    <ul className={styles.influenceList}>
      {data.arrows.map((arrow) => (
        <li key={`${arrow.from.basket}>${arrow.to.basket}`}>
          <span><b>{arrow.from.label}</b> → <b>{arrow.to.label}</b></span>
          <span className={arrow.sign < 0 ? styles.down : styles.up}>{arrow.sign < 0 ? '↓ pushes down' : '↑ pushes up'}</span>
          <small>{arrow.reportDays} report days{arrow.isNew ? ' · new this year' : ''}</small>
        </li>
      ))}
    </ul>
  )
}

/**
 * The Layers panel (v27 §5/§8): how the map is built, then what is drawn over it.
 * The Pro layers are shown locked for others.
 */
export default function AtlasLayers(props: Props) {
  const { pro, onLocked } = props
  return (
    <>
      <h3 className={styles.layerGroup}>Map</h3>
      <Row feature="lens" pro={pro} onLocked={onLocked}>
        <Mode
          title="What moves together"
          hint={pro && props.lens === 'total' ? 'Every price move, the whole market included.' : 'Without the move the whole market shares, so the rest stands out.'}
          options={LENSES}
          optionDetails={LENS_DETAILS}
          value={pro ? props.lens : 'residual'}
          onChange={props.onLens}
          pro={pro}
        />
      </Row>
      <Row feature="regionsize" pro={pro} onLocked={onLocked}>
        <Mode
          title="Region size"
          hint="Draw each region by how many companies it holds, or by their market value."
          options={REGION_SIZES}
          optionDetails={REGION_SIZE_DETAILS}
          value={pro && props.byValue ? 'value' : 'companies'}
          onChange={(value) => props.onByValue(value === 'value')}
          pro={pro}
        />
      </Row>

      <h3 className={styles.layerGroup}>Overlays</h3>
      <Row feature="accuracy" pro={pro} onLocked={onLocked}>
        <Overlay symbol="ring" title="Fidelity ring" hint="Green when a company sits among its ties, red when the map stretched them." checked={pro && props.showFidelity} onChange={props.onFidelity} pro={pro} />
      </Row>
      <Row feature="influence" pro={pro} onLocked={onLocked}>
        <Overlay symbol="influence" title="Influence arrows" hint="One group moves on the day another reports results, two years running." checked={pro && props.showInfluence} disabled={pro && props.lens !== 'residual'} onChange={props.onInfluence} pro={pro} />
        {pro ? <InfluenceList influence={props.influence} lens={props.lens} /> : null}
      </Row>
    </>
  )
}
