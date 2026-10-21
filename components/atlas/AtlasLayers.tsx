'use client'

import type { ReactNode } from 'react'
import type { AtlasLens } from '@/lib/atlas-model'
import type { ProFeature } from '@/lib/atlas-pro'
import type { AtlasInfluence } from '@/lib/atlas-pro-model'
import type { Remote } from './use-atlas-json'
import base from './AtlasExplorer.module.css'
import styles from './AtlasPro.module.css'

type Props = {
  pro: boolean
  lens: AtlasLens
  byValue: boolean
  showFidelity: boolean
  showInfluence: boolean
  influence: Remote<AtlasInfluence>
  showNames: boolean
  keyOpen: boolean
  onLens: (lens: AtlasLens) => void
  onByValue: (value: boolean) => void
  onFidelity: (value: boolean) => void
  onInfluence: (value: boolean) => void
  onNames: (value: boolean) => void
  onKey: (value: boolean) => void
  onLocked: (feature: ProFeature, anchor: HTMLElement) => void
}

function Layer({ feature, title, pro, onLocked, children }: { feature: ProFeature; title: string; pro: boolean; onLocked: Props['onLocked']; children: ReactNode }) {
  return (
    <div
      className={pro ? styles.layer : `${styles.layer} ${styles.locked}`}
      // a locked layer answers any press with the upsell, and its controls do nothing
      onClickCapture={pro ? undefined : (event) => {
        event.preventDefault()
        event.stopPropagation()
        onLocked(feature, event.target instanceof HTMLElement ? event.target : event.currentTarget)
      }}
    >
      <h3 className={base.eyebrow}>{title} {pro ? null : <span className={styles.proTag}>Pro</span>}</h3>
      {children}
    </div>
  )
}

function Segmented({ label, options, value, onChange, locked }: { label: string; options: Array<[string, string]>; value: string; onChange: (value: string) => void; locked: boolean }) {
  return (
    <div className={styles.seg} role="group" aria-label={locked ? `${label}: Pro` : label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>
      ))}
    </div>
  )
}

/** The influence list in the Layers sheet; a locked feature carries no data. */
function InfluenceList({ influence, lens }: { influence: Remote<AtlasInfluence>; lens: AtlasLens }) {
  if (lens !== 'residual') return <p className={styles.empty}>Shown with the &quot;Beyond the market&quot; view.</p>
  if (influence.status === 'loading') return <p className={styles.muted} role="status">Loading…</p>
  if (influence.status !== 'ok') return influence.status === 'idle' ? null : <p className={styles.empty}>The influence test could not load.</p>
  const data = influence.data
  if (!data.tested) return <p className={styles.empty}>{data.reason === 'no_report_dates' ? 'Needs report dates for these companies.' : 'Needs two years of history.'}</p>
  if (!data.arrows.length) return <p className={styles.empty}>No influence between groups passes the test in the current data. It is checked every week; arrows appear here when one does.</p>
  return (
    <div className={styles.influenceList}>
      {data.arrows.map((arrow) => (
        <p key={`${arrow.from.basket}>${arrow.to.basket}`}>
          <b>{arrow.from.label}</b> → <b>{arrow.to.label}</b>{' '}
          <span className={arrow.sign < 0 ? styles.down : styles.up}>{arrow.sign < 0 ? '↓ pushes down' : '↑ pushes up'}</span><br />
          <small>{arrow.reportDays} report days{arrow.isNew ? ' · new this year' : ''}</small>
        </p>
      ))}
    </div>
  )
}

/** The Layers sheet (v27 §5/§8): what the map is built on and drawn with; the Pro layers are locked for others. */
export default function AtlasLayers(props: Props) {
  const { pro, onLocked } = props
  return (
    <>
      <div className={styles.layer}>
        <h3 className={base.eyebrow}>Reading</h3>
        <label className={base.toggle}>
          <input type="checkbox" checked={props.showNames} onChange={(event) => props.onNames(event.target.checked)} /> Names on the map
        </label>
        <label className={base.toggle}>
          <input type="checkbox" checked={props.keyOpen} onChange={(event) => props.onKey(event.target.checked)} /> Map key
        </label>
      </div>
      <Layer feature="lens" title="What moves together" pro={pro} onLocked={onLocked}>
        <Segmented label="What moves together" locked={!pro} value={pro ? props.lens : 'residual'} onChange={(value) => props.onLens(value as AtlasLens)}
          options={[['residual', 'Beyond the market'], ['total', 'Total co-movement']]} />
      </Layer>
      <Layer feature="regionsize" title="Region size" pro={pro} onLocked={onLocked}>
        <Segmented label="Region size" locked={!pro} value={pro && props.byValue ? 'value' : 'companies'} onChange={(value) => props.onByValue(value === 'value')}
          options={[['companies', 'Companies'], ['value', 'Market value']]} />
      </Layer>
      <Layer feature="accuracy" title="Map accuracy" pro={pro} onLocked={onLocked}>
        <label className={base.toggle}>
          <input type="checkbox" checked={pro && props.showFidelity} onChange={(event) => props.onFidelity(event.target.checked)} /> Ring on each company: green placed among its ties, red stretched
        </label>
      </Layer>
      <Layer feature="influence" title="Influence between groups" pro={pro} onLocked={onLocked}>
        <label className={base.toggle}>
          <input type="checkbox" checked={pro && props.showInfluence} disabled={pro && props.lens !== 'residual'} onChange={(event) => props.onInfluence(event.target.checked)} /> Influence arrows
        </label>
        {pro ? <InfluenceList influence={props.influence} lens={props.lens} /> : null}
      </Layer>
    </>
  )
}
