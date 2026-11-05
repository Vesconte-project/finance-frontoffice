'use client'

import { useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import ChartFrame, { ChartPlot } from '@/components/stocks/research/ChartFrame'
import { buttonClass } from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import PromptPanel from '@/components/ui/PromptPanel'
import { labelPosition } from '@/lib/chart-labels'
import { COMPACT_BOX, WIDE_BOX, orbitGeometry, type OrbitGeometry, type OrbitNode } from '@/lib/relationship-orbit'
import { OrbitReading, hueStyle, useOrbitFocus, zoneName, type OrbitCompany, type OrbitZone } from './OrbitFocus'
import styles from './RelationshipOrbit.module.css'

type Props = {
  /** Regions by the share of the company's ties, largest first. */
  zoneOrder: string[]
  /** Ties that exist but need an account. */
  hidden: number
  signUpHref: string
  signInHref: string
}

/** What the drawing parts read: the orbit's props and the shared focus. */
type Shared = Props & {
  symbol: string
  zoneId: string
  zones: Record<string, OrbitZone>
  ties: OrbitCompany[]
  active: string | null
  /** A pointer enters a company: a mouse lights it; a touch waits for the tap. */
  enter: (symbol: string, event: PointerEvent) => void
  leave: (event: PointerEvent) => void
  /** Keyboard focus lights a company directly. */
  select: (symbol: string | null) => void
}

/**
 * A company's strongest ties drawn as an orbit around it, in the atlas's own
 * language: each region a tinted sector with a coastline, each tie a shaded
 * ball in its region's colour, closer to the centre the stronger it moves with
 * the company. Ties that need an account share one hatched, locked sector;
 * opening it explains what a free account shows.
 */
export default function RelationshipOrbit(props: Props) {
  const { hidden } = props
  const focus = useOrbitFocus()
  const { symbol, zones, ties, active, setActive } = focus
  const [lockedOpen, setLockedOpen] = useState(false)
  const lockRef = useRef<HTMLButtonElement | null>(null)
  const createRef = useRef<HTMLAnchorElement | null>(null)
  // A pattern is referenced as url(#id): keep the id to characters that need no escaping.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const input = useMemo(() => ({
    zoneId: focus.zoneId,
    ties: ties.map((tie) => ({ symbol: tie.symbol, zoneId: tie.zoneId, correlation: tie.correlation })),
    hidden,
    zoneOrder: props.zoneOrder,
  }), [focus.zoneId, props.zoneOrder, ties, hidden])
  const wide = useMemo(() => orbitGeometry(input, WIDE_BOX), [input])
  const compact = useMemo(() => orbitGeometry(input, COMPACT_BOX), [input])
  const description = `${symbol} at the centre, the ${ties.length} companies it moves most with around it, grouped by region; the closer a company sits, the more it moves with ${symbol}, on a fixed scale from 0 to 1.${hidden ? ` ${hidden} more need a free account.` : ''}`

  const shared: Shared = {
    ...props,
    symbol,
    zoneId: focus.zoneId,
    zones,
    ties,
    active,
    enter: (target, event) => {
      if (event.pointerType === 'mouse') setActive(target)
    },
    leave: (event) => {
      if (event.pointerType === 'mouse') setActive(null)
    },
    select: setActive,
  }

  const openLocked = (target: HTMLButtonElement) => {
    lockRef.current = target
    setLockedOpen(true)
  }

  /** A tap on a company first reads it; a second tap, or a click, opens it. */
  const open = (target: string, event: MouseEvent<HTMLAnchorElement>, touch: boolean) => {
    if (touch && active !== target) {
      event.preventDefault()
      setActive(target)
    }
  }

  const plot = (geometry: OrbitGeometry, variant: 'wide' | 'compact') => (
    <ChartPlot
      box={geometry.box}
      variant={variant}
      labels={<Labels geometry={geometry} shared={shared} onLocked={openLocked} onOpen={open} />}
    >
      <Drawing geometry={geometry} shared={shared} patternId={`${id}-${variant}-hatch`} />
    </ChartPlot>
  )

  return (
    <div className={styles.orbit} data-relationship-orbit="" data-active={active ? 'true' : undefined}>
      <ChartFrame ariaLabel={description}>
        {plot(wide, 'wide')}
        {plot(compact, 'compact')}
      </ChartFrame>
      <div className={styles.overlay}>
        <OrbitReading variant="overlay" />
      </div>
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
  shared: Shared
}

function Drawing({ geometry, shared, patternId }: PartProps & { patternId: string }) {
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
        <g
          key={sector.zoneId ?? 'locked'}
          className={sector.zoneId ? styles.zoned : styles.lockedSector}
          style={hueStyle(shared.zones, sector.zoneId)}
          data-own={sector.zoneId === shared.zoneId ? 'true' : undefined}
        >
          <path
            d={sector.path}
            className={styles.sector}
            style={{ animationDelay: `${index * 60}ms`, ...(sector.zoneId ? {} : { fill: `url(#${patternId})` }) }}
          />
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
        <Tie key={node.symbol} node={node} index={index} origin={origin} shared={shared} />
      ))}
      <circle cx={centre.x} cy={centre.y} r={core + 10} className={styles.halo} style={origin} />
      <circle cx={centre.x} cy={centre.y} r={core} className={styles.core} />
      <circle cx={centre.x - core * 0.32} cy={centre.y - core * 0.36} r={core * 0.34} className={styles.shine} />
    </>
  )
}

function Tie({ node, index, origin, shared }: { node: OrbitNode; index: number; origin: CSSProperties; shared: Shared }) {
  const state = shared.active === null ? undefined : shared.active === node.symbol ? 'on' : 'off'
  return (
    <g
      className={`${styles.tie} ${styles.zoned}`}
      style={{ ...origin, ...hueStyle(shared.zones, node.zoneId), '--i': index } as CSSProperties}
      data-state={state}
      onPointerEnter={(event) => shared.enter(node.symbol, event)}
      onPointerLeave={shared.leave}
    >
      <line
        x1={node.from.x}
        y1={node.from.y}
        x2={node.x}
        y2={node.y}
        className={styles.line}
        style={{ strokeWidth: 0.8 + node.strength * 2.6, '--o': 0.28 + node.strength * 0.6 } as CSSProperties}
      />
      <circle cx={node.x} cy={node.y + node.radius * 0.35} r={node.radius} className={styles.shadow} />
      <circle cx={node.x} cy={node.y} r={node.radius} className={styles.ball} />
      <circle cx={node.x - node.radius * 0.32} cy={node.y - node.radius * 0.36} r={node.radius * 0.36} className={styles.shine} />
    </g>
  )
}

/** A name above the orbit grows upwards and one below it downwards, so a second line never meets the coast. */
function awayFrom(dy: number, radius: number): 'start' | 'middle' | 'end' {
  if (dy < -radius * 0.5) return 'end'
  if (dy > radius * 0.5) return 'start'
  return 'middle'
}

function Labels({ geometry, shared, onLocked, onOpen }: PartProps & {
  onLocked: (target: HTMLButtonElement) => void
  onOpen: (symbol: string, event: MouseEvent<HTMLAnchorElement>, touch: boolean) => void
}) {
  const { box, centre } = geometry
  const touch = useRef(false)
  return (
    <>
      {geometry.rings.filter((item) => item.labelled).map((item) => (
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
          data-own={sector.zoneId === shared.zoneId ? 'true' : undefined}
          data-anchor={sector.label.anchor}
          style={{ ...labelPosition(box, sector.label.x, sector.label.y, sector.label.anchor, awayFrom(sector.label.y - centre.y, geometry.outer)), ...hueStyle(shared.zones, sector.zoneId) }}
        >
          <span className={styles.zoneName}>
            <i className={styles.swatch} aria-hidden="true" />
            {zoneName(shared.zones, sector.zoneId)}
          </span>
          {sector.zoneId === shared.zoneId ? <span className={styles.ownTag}>{shared.symbol}&rsquo;s region</span> : null}
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
          <span>{shared.hidden} more</span>
        </button>
      ))}
      {geometry.nodes.map((node) => {
        const tie = shared.ties.find((item) => item.symbol === node.symbol)
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
            data-state={shared.active === null ? undefined : shared.active === node.symbol ? 'on' : 'off'}
            onPointerDown={(event) => { touch.current = event.pointerType !== 'mouse' }}
            onKeyDown={() => { touch.current = false }}
            onPointerEnter={(event) => shared.enter(node.symbol, event)}
            onPointerLeave={shared.leave}
            onClick={(event) => onOpen(node.symbol, event, touch.current)}
            onFocus={() => { if (!touch.current) shared.select(node.symbol) }}
            onBlur={() => { if (!touch.current) shared.select(null) }}
            aria-label={`${node.symbol}${tie?.name ? `, ${tie.name}` : ''}: ${node.correlation.toFixed(2)}, ${zoneName(shared.zones, node.zoneId)}`}
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
        {shared.symbol}
      </span>
    </>
  )
}
