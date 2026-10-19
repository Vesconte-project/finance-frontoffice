'use client'

import { THEME_VERDICTS, influenceSentence } from '@/lib/atlas-pro'
import type { AtlasInfluence, AtlasTheme } from '@/lib/atlas-pro-model'
import styles from './AtlasPro.module.css'

/** The theme card (pro-spec §4c): what funds hold together, and whether prices confirm it. */
export function ThemeCard({ theme, labelOf }: { theme: AtlasTheme; labelOf: (zoneId: string, fallback: string | null) => string }) {
  const verdict = theme.verdict ? THEME_VERDICTS[theme.verdict] : null
  return (
    <div className={styles.card} role="region" aria-label={`Theme: ${theme.label}`}>
      <p className={styles.eyebrow}>Theme</p>
      <b className={styles.cardTitle}>{theme.label}</b>
      <small>{theme.memberCount} companies that thematic funds hold together. Regions on the map come from prices, so a theme can spread across several.</small>
      {verdict ? (
        <>
          <p className={styles.verdict}>
            {verdict[0]}{' '}
            {theme.cohesion !== null && theme.typicalCohesion !== null ? <span>{theme.cohesion.toFixed(2)} vs {theme.typicalCohesion.toFixed(2)} in a typical region</span> : null}
          </p>
          <p>{verdict[1]}</p>
        </>
      ) : <p className={styles.muted}>Not enough of its companies are on the map to say whether prices confirm it.</p>}
      {theme.regions.length ? <p><small>Mostly in: {theme.regions.map((region) => `${labelOf(region.zoneId, region.label)} ${Math.round(region.share * 100)}%`).join(' · ')}</small></p> : null}
    </div>
  )
}

/** The influence card (pro-spec §3c): each arrow in words, or that nothing passes. */
export function InfluenceCard({ influence }: { influence: AtlasInfluence }) {
  return (
    <div className={styles.card} role="region" aria-label="Influence">
      <p className={styles.eyebrow}>Influence</p>
      {!influence.tested ? (
        <p>{influence.reason === 'no_report_dates' ? 'Needs report dates for these companies.' : 'Needs two years of history.'}</p>
      ) : influence.arrows.length ? (
        <>
          {influence.arrows.map((arrow) => (
            <p key={`${arrow.from.basket}>${arrow.to.basket}`}>
              <b>{arrow.from.label} → {arrow.to.label}</b><br />
              <small>{influenceSentence(arrow)}</small>
            </p>
          ))}
          <p><small>Same-day evidence from prices; strong, not proof.</small></p>
        </>
      ) : (
        <p>No influence between groups passes the test in the current data. It is checked every week.</p>
      )}
    </div>
  )
}
