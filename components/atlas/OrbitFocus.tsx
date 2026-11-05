'use client'

import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import styles from './RelationshipOrbit.module.css'

export type OrbitZone = { label: string; hue: number }
export type OrbitCompany = { symbol: string; name: string | null; zoneId: string | null; correlation: number }

type Focus = {
  symbol: string
  zoneId: string
  zones: Record<string, OrbitZone>
  ties: OrbitCompany[]
  /** The company under the pointer or focus; it lights its tie and dims the others. */
  active: string | null
  /** The company the reading shows: the active one, else the last one read. */
  reading: OrbitCompany | null
  setActive: (symbol: string | null) => void
  clear: () => void
}

const OrbitFocusContext = createContext<Focus | null>(null)

export const zoneName = (zones: Record<string, OrbitZone>, zoneId: string | null) =>
  (zoneId && zones[zoneId]?.label.replace(/_/g, ' ')) || 'Another region'

export const hueStyle = (zones: Record<string, OrbitZone>, zoneId: string | null) =>
  ({ '--h': zoneId ? zones[zoneId]?.hue ?? 210 : 210 }) as CSSProperties

/** Shares which company is in focus between the orbit and its reading, wherever the reading sits. */
export function OrbitFocusProvider({ symbol, zoneId, zones, ties, children }: Omit<Focus, 'active' | 'reading' | 'setActive' | 'clear'> & { children: ReactNode }) {
  const [active, setActiveState] = useState<string | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const value = useMemo<Focus>(() => {
    const find = (target: string | null) => (target ? ties.find((tie) => tie.symbol === target) ?? null : null)
    return {
      symbol,
      zoneId,
      zones,
      ties,
      active,
      reading: find(active) ?? find(last),
      setActive: (next) => {
        setActiveState(next)
        if (next) setLast(next)
      },
      clear: () => {
        setActiveState(null)
        setLast(null)
      },
    }
  }, [symbol, zoneId, zones, ties, active, last])
  return <OrbitFocusContext.Provider value={value}>{children}</OrbitFocusContext.Provider>
}

export function useOrbitFocus(): Focus {
  const focus = useContext(OrbitFocusContext)
  if (!focus) throw new Error('useOrbitFocus needs an OrbitFocusProvider')
  return focus
}

/**
 * The reading of one tie: who, which region, and its value on the same fixed
 * 0–1 scale the orbit uses, so a weak tie reads as weak at a glance. Beside the
 * orbit it sits in the chapter's side column; on a narrow chapter it is a card
 * over the bottom of the orbit, opened by a tap.
 */
export function OrbitReading({ variant }: { variant: 'aside' | 'overlay' }) {
  const { symbol, zoneId, zones, reading, clear } = useOrbitFocus()
  if (!reading) {
    if (variant === 'overlay') return null
    return (
      <div className={styles.readingCard} data-variant="aside" data-orbit-reading="">
        <p className={styles.readingHint}>Point at a company on the orbit to read its tie with {symbol}.</p>
      </div>
    )
  }
  const sameRegion = reading.zoneId !== null && reading.zoneId === zoneId
  const value = Math.max(0, Math.min(1, reading.correlation))
  return (
    <div className={styles.readingCard} data-variant={variant} data-orbit-reading="" aria-live="polite">
      <div className={styles.readingHead}>
        <i className={styles.swatch} style={hueStyle(zones, reading.zoneId)} aria-hidden="true" />
        <b>{reading.symbol}</b>
        {variant === 'overlay' ? (
          <button type="button" className={styles.readingClose} onClick={clear} aria-label="Close the reading">
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {reading.name ? <p className={styles.readingName}>{reading.name}</p> : null}
      <p className={styles.readingRegion} style={hueStyle(zones, reading.zoneId)}>
        {zoneName(zones, reading.zoneId)}
        <span>{sameRegion ? `· same region as ${symbol}` : `· not ${symbol}'s region`}</span>
      </p>
      <div className={styles.readingValue}>
        <strong>{reading.correlation.toFixed(2)}</strong>
        <span className={styles.readingScale} aria-hidden="true">
          <span style={{ width: `${value * 100}%` }} />
        </span>
        <span className={styles.readingEnds} aria-hidden="true"><span>0</span><span>1</span></span>
      </div>
      <Link prefetch={false} className={styles.readingLink} href={`/stocks/${encodeURIComponent(reading.symbol)}/relationships`}>
        Open {reading.symbol} →
      </Link>
    </div>
  )
}
