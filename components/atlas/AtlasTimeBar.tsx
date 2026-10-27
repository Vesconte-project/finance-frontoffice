'use client'

import { Lock, Pause, Play } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { ProFeature } from '@/lib/atlas-pro'
import styles from './AtlasPro.module.css'

type Props = {
  pro: boolean
  historyAvailable: boolean
  /** Weeks back the bar reaches (0 while the list of weeks loads). */
  span: number
  week: number
  label: string
  playing: boolean
  note: string | null
  loading: string | null
  onWeek: (week: number) => void
  onPlay: () => void
  onLocked: (feature: ProFeature, anchor: HTMLElement) => void
}

/**
 * The time bar (pro-spec §1): drag or play the last year, week by week. For
 * readers without Pro it stays on screen locked, and any part of it says why.
 */
export default function AtlasTimeBar({ pro, historyAvailable, span, week, label, playing, note, loading, onWeek, onPlay, onLocked }: Props) {
  if (!historyAvailable) return null
  const value = -Math.round(week)
  return (
    <div className={styles.timeline} data-atlas-bottom="" role="group" aria-label="Earlier weeks">
      <div className={styles.timeControls}>
        <button
          type="button"
          className={styles.play}
          aria-label={pro ? (playing ? 'Pause' : 'Play the last year') : 'Play the last year: Pro'}
          onClick={(event) => pro ? onPlay() : onLocked('timeline', event.currentTarget)}
          disabled={pro && span < 1}
        >
          {pro && playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
        </button>
        <span className={styles.track}>
          {pro ? (
            <>
              <input
                type="range"
                min={-span}
                max={0}
                step={1}
                value={value}
                disabled={span < 1}
                style={{ '--atlas-time-progress': `${span ? ((span + value) / span) * 100 : 100}%` } as CSSProperties}
                aria-label="Weeks before today"
                aria-valuetext={label}
                onChange={(event) => onWeek(-Number(event.target.value))}
              />
              <span className={styles.timeEnds} aria-hidden="true"><span>{span === 52 ? '1 year ago' : span > 0 ? `${span} weeks ago` : 'Earlier weeks'}</span><span>Now</span></span>
            </>
          ) : (
            <button type="button" className={styles.trackLock} aria-label="Earlier weeks: Pro" title="Earlier weeks: Pro" onClick={(event) => onLocked('timeline', event.currentTarget)}>
              <span className={styles.timeTicks} aria-hidden="true">{Array.from({ length: 13 }, (_, index) => <i key={index} />)}</span>
              <span className={styles.historyBadge}><Lock size={10} aria-hidden="true" /> Past year · Pro</span>
            </button>
          )}
        </span>
        <output className={styles.weekLabel} aria-live="off">{pro ? label : 'Today'}</output>
        {pro && (note || loading) ? <small className={styles.timelineNote} role="status">{loading ?? note}</small> : null}
      </div>
    </div>
  )
}
