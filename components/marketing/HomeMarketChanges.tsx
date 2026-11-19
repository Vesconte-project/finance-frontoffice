import type { CSSProperties } from 'react'
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import AccountEntryLink from '@/components/AccountEntryLink'
import styles from './HomeMarketStory.module.css'

type ScoreChange = { symbol: string; reading: string; previous: number; next: number }
type SectorMove = { symbol: string; context: string; change: number }

type MarketBriefing = {
  scoreChanges: readonly ScoreChange[]
  sectorMoves: readonly SectorMove[]
}

const PERCENT = new Intl.NumberFormat('en', { signDisplay: 'exceptZero', maximumFractionDigits: 1 })

export default function HomeMarketChanges({ briefing }: { briefing: MarketBriefing | null }) {
  const [featured, ...otherScores] = briefing?.scoreChanges ?? []
  const sectorMoves = briefing?.sectorMoves ?? []
  const sectorScale = Math.max(5, ...sectorMoves.map(({ change }) => Math.abs(change)))

  return (
    <section data-market-scene="updates" className={styles.scene} aria-labelledby="home-updates-title">
      <div className={`${styles.stage} ${styles.updatesStage}`}>
        <header className={styles.updatesHeader}>
          <h2 id="home-updates-title">What changed while you were away?</h2>
        </header>

        <div className={styles.updateGrid}>
          <article className={styles.scoreFeature} aria-labelledby="home-score-title">
            <h3 id="home-score-title">Score changes</h3>
            {featured
              ? <ScoreChangeFeature change={featured} otherScores={otherScores} />
              : <p>Daily score changes are unavailable.</p>}
          </article>

          <div className={styles.briefingSide}>
            <section aria-labelledby="home-sector-title">
              <h3 id="home-sector-title">Against the sector</h3>
              {sectorMoves.length ? (
                <ul className={styles.sectorMoves}>
                  {sectorMoves.map(({ symbol, context, change }) => (
                    <li key={symbol} data-direction={change > 0 ? 'up' : 'down'}>
                      <div><strong>{symbol}</strong><p>{context}</p></div>
                      <span className={styles.sectorBar} style={{ '--move': `${Math.abs(change) / sectorScale * 50}%` } as CSSProperties} aria-hidden="true" />
                      <span className={styles.sectorValue}>{PERCENT.format(change)}%</span>
                    </li>
                  ))}
                </ul>
              ) : <p>Daily sector comparisons are unavailable.</p>}
            </section>
            <aside className={styles.watchlistCard}>
              <div>
                <h3>Your watchlist</h3>
                <p>See when your companies’ readings change.</p>
              </div>
              <AccountEntryLink
                className={styles.watchlistLink}
                signedOutLabel="Create free account"
                signedInLabel="Open your watchlist"
                signedInHref="/dashboard/watchlist"
                analyticsId="home_updates_signup"
              />
            </aside>
          </div>
        </div>
      </div>
    </section>
  )
}

function ScoreChangeFeature({ change, otherScores }: { change: ScoreChange; otherScores: readonly ScoreChange[] }) {
  const { symbol, reading, previous, next } = change
  const rising = next > previous
  const Direction = rising ? ArrowUpRight : ArrowDownLeft
  const delta = Math.abs(next - previous)

  return (
    <div data-direction={rising ? 'up' : 'down'}>
      <div className={styles.featureHeader}>
        <div className={styles.featureCompany}>
          <strong>{symbol}</strong>
          <span>{reading}</span>
        </div>
        <span className={styles.featureDelta}>
          <Direction aria-hidden="true" size={16} /> {delta} {delta === 1 ? 'point' : 'points'} {rising ? 'higher' : 'lower'}
        </span>
      </div>
      <div className={styles.featureScore}>
        <span>{previous}</span>
        <ArrowRight aria-label="to" role="img" />
        <strong>{next}</strong>
      </div>
      <div
        className={styles.scoreScale}
        style={{ '--previous-score': `${previous}%`, '--current-score': `${next}%` } as CSSProperties}
        aria-label="Score scale from 0 to 100"
        role="img"
      >
        <div className={styles.scaleTrack}>
          <span className={styles.scalePrevious} />
          <span className={styles.scaleCurrent} />
        </div>
        <div className={styles.scaleTicks}><span>0</span><span>50</span><span>100</span></div>
      </div>
      {otherScores.length > 0 && (
        <ul className={styles.otherScores} aria-label="Other score changes">
          {otherScores.map(({ symbol, reading, previous, next }) => (
            <li key={`${symbol}-${reading}`} data-direction={next > previous ? 'up' : 'down'}>
              <strong>{symbol}</strong>
              <span>{reading}</span>
              <span>{previous} → {next}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
