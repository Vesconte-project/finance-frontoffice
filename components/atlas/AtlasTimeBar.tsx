'use client'

import { Lock, Pause, Play } from 'lucide-react'
import type { ProFeature } from '@/lib/atlas-pro'
import styles from './AtlasPro.module.css'

type Props = {
  pro: boolean
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
export default function AtlasTimeBar({ pro, span, week, label, playing, note, loading, onWeek, onPlay, onLocked }: Props) {
  if (!pro) {
    return (
      <div className={`${styles.timeline} ${styles.timelineLocked}`} data-atlas-bottom="" role="group" aria-label="Earlier weeks">
        <button type="button" className={styles.play} aria-label="Play the last year: Pro" onClick={(event) => onLocked('timeline', event.currentTarget)}>
          <Play size={13} aria-hidden="true" />
        </button>
        <span className={styles.track}>
          <button type="button" className={styles.trackLock} aria-label="Earlier weeks: Pro" title="Earlier weeks: Pro" onClick={(event) => onLocked('timeline', event.currentTarget)}>
            <Lock size={12} aria-hidden="true" />
          </button>
        </span>
        <output className={styles.weekLabel}>Today</output>
      </div>
    )
  }
  const value = -Math.round(week)
  return (
    <div className={styles.timeline} data-atlas-bottom="" role="group" aria-label="Earlier weeks">
      <button type="button" className={styles.play} aria-label={playing ? 'Pause' : 'Play the last year'} onClick={onPlay} disabled={span < 1}>
        {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
      </button>
      <span className={styles.track}>
        <input
          type="range"
          min={-span}
          max={0}
          step={1}
          value={value}
          disabled={span < 1}
          aria-label="Weeks before today"
          aria-valuetext={label}
          onChange={(event) => onWeek(-Number(event.target.value))}
        />
      </span>
      <output className={styles.weekLabel} aria-live="off">{label}</output>
      {note || loading ? <small className={styles.timelineNote} role="status">{loading ?? note}</small> : null}
    </div>
  )
}
