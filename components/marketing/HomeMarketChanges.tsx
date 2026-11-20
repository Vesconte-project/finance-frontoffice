import { Suspense, type CSSProperties } from 'react'
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import AccountEntryLink from '@/components/AccountEntryLink'
import { fetchBackendJson } from '@/lib/backend'
import { parseHomeScoreChanges, type HomeScoreChange } from '@/lib/home-market-briefing'
import { PICK_READING_CONTENT } from '@/lib/picks-content'
import styles from './HomeMarketStory.module.css'

export default function HomeMarketChanges() {
  return (
    <section data-market-scene="updates" className={styles.scene} aria-labelledby="home-updates-title">
      <div className={`${styles.stage} ${styles.updatesStage}`}>
        <header className={styles.updatesHeader}>
          <h2 id="home-updates-title">What changed while you were away?</h2>
        </header>

        <div className={styles.updateGrid}>
          <article className={styles.scoreFeature} aria-labelledby="home-score-title">
            <h3 id="home-score-title">Score changes</h3>
            <Suspense fallback={<p role="status">Loading score changes…</p>}>
              <HomeScoreChanges />
            </Suspense>
          </article>

          <div className={styles.briefingSide}>
            <section aria-labelledby="home-sector-title">
              <h3 id="home-sector-title">Against the sector</h3>
              {/* The briefing contract defines sectorMoves as unavailable until ENG-159. */}
              <p>Daily sector comparisons are unavailable.</p>
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

async function HomeScoreChanges() {
  const payload = await fetchBackendJson<unknown>('/v1/market/briefing', {
    context: 'backend.market.briefing',
    timeoutMs: 2500,
  }).catch(() => null)
  const changes = parseHomeScoreChanges(payload)
  if (changes === null) return <p>Daily score changes are unavailable.</p>
  const [featured, ...otherScores] = changes
  if (!featured) return <p>No score changes in the latest briefing.</p>
  return <ScoreChangeFeature change={featured} otherScores={otherScores} />
}

function ScoreChangeFeature({ change, otherScores }: { change: HomeScoreChange; otherScores: readonly HomeScoreChange[] }) {
  const { symbol, reading, previous, next } = change
  const rising = next > previous
  const Direction = rising ? ArrowUpRight : ArrowDownLeft
  const delta = Math.abs(next - previous)

  return (
    <div data-direction={rising ? 'up' : 'down'}>
      <div className={styles.featureHeader}>
        <div className={styles.featureCompany}>
          <strong>{symbol}</strong>
          <span>{PICK_READING_CONTENT[reading].label}</span>
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
              <span>{PICK_READING_CONTENT[reading].label}</span>
              <span>{previous} → {next}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
