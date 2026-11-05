'use client'

import { useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import ChartFrame, { ChartPlot } from '@/components/stocks/research/ChartFrame'
import { buttonClass } from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import PromptPanel from '@/components/ui/PromptPanel'
import { labelPosition } from '@/lib/chart-labels'
import { COMPACT_BOX, WIDE_BOX, orbitGeometry, type OrbitGeometry, type OrbitNode } from '@/lib/relationship-orbit'
import styles from './RelationshipOrbit.module.css'

export type OrbitZone = { label: string; hue: number }
export type OrbitCompany = { symbol: string; name: string | null; zoneId: string | null; correlation: number }

type Props = {
  symbol: string
  zoneId: string
  /** Every region named on the orbit, with its atlas colour. */
  zones: Record<string, OrbitZone>
  /** Regions by the share of the company's ties, largest first. */
  zoneOrder: string[]
  ties: OrbitCompany[]
  /** Ties that exist but need an account. */
  hidden: number
  signUpHref: string
  signInHref: string
}

const zoneName = (zones: Record<string, OrbitZone>, zoneId: string | null) =>
  (zoneId && zones[zoneId]?.label.replace(/_/g, ' ')) || 'Another region'

const hueStyle = (zones: Record<string, OrbitZone>, zoneId: string | null) =>
  ({ '--h': zoneId ? zones[zoneId]?.hue ?? 210 : 210 }) as CSSProperties

/**
 * A company's strongest ties drawn as an orbit around it, in the atlas's own
 * language: each region a tinted sector with a coastline, each tie a shaded
 * ball in its region's colour, closer to the centre the stronger it moves with
 * the company. Ties that need an account share one hatched, locked sector;
 * opening it explains what a free account shows.
 */
export default function RelationshipOrbit(props: Props) {
  const { symbol, zones, ties, hidden } = props
  const [active, setActive] = useState<string | null>(null)
  const [lockedOpen, setLockedOpen] = useState(false)
  const lockRef = useRef<HTMLButtonElement | null>(null)
  const createRef = useRef<HTMLAnchorElement | null>(null)
  const id = useId()
  const input = useMemo(() => ({
    zoneId: props.zoneId,
    ties: ties.map((tie) => ({ symbol: tie.symbol, zoneId: tie.zoneId, correlation: tie.correlation })),
    hidden,
    zoneOrder: props.zoneOrder,
  }), [props.zoneId, props.zoneOrder, ties, hidden])
  const wide = useMemo(() => orbitGeometry(input, WIDE_BOX), [input])
  const compact = useMemo(() => orbitGeometry(input, COMPACT_BOX), [input])
  const bySymbol = useMemo(() => new Map(ties.map((tie) => [tie.symbol, tie])), [ties])
  const reading = active ? bySymbol.get(active) ?? null : null
  const description = `${symbol} at the centre, the ${ties.length} companies it moves most with around it, grouped by region, closer the stronger the tie.${hidden ? ` ${hidden} more need a free account.` : ''}`

  const openLocked = (target: HTMLButtonElement) => {
    lockRef.current = target
    setLockedOpen(true)
  }

  const plot = (geometry: OrbitGeometry, variant: 'wide' | 'compact') => (
    <ChartPlot
      box={geometry.box}
      variant={variant}
      labels={<Labels geometry={geometry} props={props} active={active} setActive={setActive} onLocked={openLocked} />}
    >
      <Drawing geometry={geometry} props={props} active={active} setActive={setActive} patternId={`${id}-${variant}-hatch`} />
    </ChartPlot>
  )

  return (
    <div className={styles.orbit} data-relationship-orbit="" data-active={active ? 'true' : undefined}>
      <ChartFrame ariaLabel={description}>
        {plot(wide, 'wide')}
        {plot(compact, 'compact')}
      </ChartFrame>
      <p className={styles.reading} aria-live="polite" data-orbit-reading="">
        {reading ? (
          <>
            <i className={styles.swatch} style={hueStyle(zones, reading.zoneId)} aria-hidden="true" />
            <b>{reading.symbol}</b>
            {reading.name ? <span>{reading.name}</span> : null}
            <span className={styles.readingZone}>{zoneName(zones, reading.zoneId)}</span>
            <strong>{reading.correlation.toFixed(2)}</strong>
          </>
        ) : (
          <span className={styles.readingHint}>Point at a company to read its tie with {symbol}.</span>
        )}
      </p>
      {hidden > 0 ? (
        <Dialog
          open={lockedOpen}
          onClose={() => setLockedOpen(false)}
          labelledBy={`${id}-locked-title`}
          describedBy={`${id}-locked-description`}
          initialFocusRef={createRef}
          returnFocusRef={lockRef}
        >
          <PromptPanel
            ticker={symbol}
            status="invite"
            statusLabel="Free account"
            title={`See every company ${symbol} moves with`}
            titleId={`${id}-locked-title`}
            description={`${symbol} has ${ties.length + hidden} ties above the market average this week. Without an account you see the ${ties.length} strongest. A free account gives you:`}
            descriptionId={`${id}-locked-description`}
            points={[
              <>All {ties.length + hidden} companies {symbol} moves with, and the region each one sits in</>,
              <>The full weekly market atlas, with every region and company in its real place</>,
            ]}
            note="No card, no trial."
            actions={(
              <>
                <Link ref={createRef} href={props.signUpHref} className={buttonClass({ variant: 'primary', size: 'md' })}>Create account</Link>
                <Link href={props.signInHref} className={buttonClass({ variant: 'ghost', size: 'md' })}>Sign in</Link>
              </>
            )}
          />
        </Dialog>
      ) : null}
    </div>
  )
}

type PartProps = {
  geometry: OrbitGeometry
  props: Props
  active: string | null
  setActive: (symbol: string | null) => void
}

function Drawing({ geometry, props, active, setActive, patternId }: PartProps & { patternId: string }) {
  const { centre, core } = geometry
  const origin = { transformOrigin: `${centre.x}px ${centre.y}px` } as CSSProperties
  return (
    <>
      <defs>
        <pattern id={patternId} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" className={styles.hatch} />
        </pattern>
      </defs>
      {geometry.rings.map((ring) => (
        <circle key={ring.value} cx={centre.x} cy={centre.y} r={ring.radius} className={styles.ring} />
      ))}
      {geometry.sectors.map((sector, index) => (
        <g key={sector.zoneId ?? 'locked'} className={sector.zoneId ? styles.zoned : styles.lockedSector} style={hueStyle(props.zones, sector.zoneId)}>
          <path d={sector.path} className={styles.sector} fill={sector.zoneId ? undefined : `url(#${patternId})`} style={{ animationDelay: `${index * 60}ms` }} />
          <path d={sector.arc} className={styles.coast} />
        </g>
      ))}
      {geometry.ghosts.map((ghost, index) => (
        <g key={`ghost-${index}`} className={styles.ghost} style={{ ...origin, '--i': index + geometry.nodes.length } as CSSProperties}>
          <line x1={centre.x} y1={centre.y} x2={ghost.x} y2={ghost.y} className={styles.ghostLine} />
          <circle cx={ghost.x} cy={ghost.y} r={ghost.radius} className={styles.ghostBall} />
        </g>
      ))}
      {geometry.nodes.map((node, index) => (
        <Tie key={node.symbol} node={node} index={index} origin={origin} props={props} active={active} setActive={setActive} />
      ))}
      <circle cx={centre.x} cy={centre.y} r={core + 10} className={styles.halo} style={origin} />
      <circle cx={centre.x} cy={centre.y} r={core} className={styles.core} />
      <circle cx={centre.x - core * 0.32} cy={centre.y - core * 0.36} r={core * 0.34} className={styles.shine} />
    </>
  )
}

function Tie({ node, index, origin, props, active, setActive }: { node: OrbitNode; index: number; origin: CSSProperties } & Omit<PartProps, 'geometry'>) {
  const state = active === null ? undefined : active === node.symbol ? 'on' : 'off'
  return (
    <g
      className={`${styles.tie} ${styles.zoned}`}
      style={{ ...origin, ...hueStyle(props.zones, node.zoneId), '--i': index } as CSSProperties}
      data-state={state}
      onPointerEnter={() => setActive(node.symbol)}
      onPointerLeave={() => setActive(null)}
    >
      <line
        x1={node.from.x}
        y1={node.from.y}
        x2={node.x}
        y2={node.y}
        className={styles.line}
        style={{ strokeWidth: 1 + node.strength * 2.4, '--o': 0.35 + node.strength * 0.5 } as CSSProperties}
      />
      <circle cx={node.x} cy={node.y + node.radius * 0.35} r={node.radius} className={styles.shadow} />
      <circle cx={node.x} cy={node.y} r={node.radius} className={styles.ball} />
      <circle cx={node.x - node.radius * 0.32} cy={node.y - node.radius * 0.36} r={node.radius * 0.36} className={styles.shine} />
    </g>
  )
}

function Labels({ geometry, props, active, setActive, onLocked }: PartProps & { onLocked: (target: HTMLButtonElement) => void }) {
  const { box, centre } = geometry
  return (
    <>
      {geometry.rings.map((item) => (
        <span
          key={item.value}
          className={styles.ringLabel}
          style={labelPosition(box, centre.x + item.radius * Math.cos(geometry.ringAngle), centre.y + item.radius * Math.sin(geometry.ringAngle), 'middle', 'middle')}
        >
          {item.value.toFixed(2)}
        </span>
      ))}
      {geometry.sectors.map((sector) => sector.zoneId ? (
        <span
          key={sector.zoneId}
          className={styles.zoneLabel}
          style={{ ...labelPosition(box, sector.label.x, sector.label.y, sector.label.anchor, 'middle'), ...hueStyle(props.zones, sector.zoneId) }}
        >
          <i className={styles.swatch} aria-hidden="true" />
          {zoneName(props.zones, sector.zoneId)}
        </span>
      ) : (
        <button
          key="locked"
          type="button"
          className={styles.lockButton}
          style={labelPosition(box, sector.middle.x, sector.middle.y, 'middle', 'middle')}
          onClick={(event) => onLocked(event.currentTarget)}
          data-orbit-locked=""
        >
          <Lock size={14} strokeWidth={2.2} aria-hidden="true" />
          <span>{props.hidden} more</span>
        </button>
      ))}
      {geometry.nodes.map((node) => {
        const tie = props.ties.find((item) => item.symbol === node.symbol)
        const dx = Math.cos(node.angle)
        const dy = Math.sin(node.angle)
        const side = dx > 0.25 ? 'start' : dx < -0.25 ? 'end' : 'middle'
        return (
          <Link
            key={node.symbol}
            prefetch={false}
            href={`/stocks/${encodeURIComponent(node.symbol)}/relationships`}
            className={styles.node}
            style={labelPosition(box, node.x, node.y, 'middle', 'middle')}
            data-state={active === null ? undefined : active === node.symbol ? 'on' : 'off'}
            onPointerEnter={() => setActive(node.symbol)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(node.symbol)}
            onBlur={() => setActive(null)}
            aria-label={`${node.symbol}${tie?.name ? `, ${tie.name}` : ''}: ${node.correlation.toFixed(2)}, ${zoneName(props.zones, node.zoneId)}`}
          >
            <span
              className={styles.ticker}
              data-side={side}
              style={{ '--dx': `${(dx * 17).toFixed(1)}px`, '--dy': `${(dy * 15).toFixed(1)}px` } as CSSProperties}
            >
              {node.symbol}
            </span>
          </Link>
        )
      })}
      <span className={styles.centreLabel} style={labelPosition(box, centre.x, centre.y + geometry.core + 14, 'middle', 'start')}>
        {props.symbol}
      </span>
    </>
  )
}
