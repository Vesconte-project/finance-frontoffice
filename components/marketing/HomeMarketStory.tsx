import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { MarketClusters, RelationshipField, RevenueFlow } from './HomeStoryPlots'
import HomeAtlasPreview from './HomeAtlasPreview'
import HomeMarketChanges from './HomeMarketChanges'
import styles from './HomeMarketStory.module.css'

export default function HomeMarketStory() {
  return (
    <div data-field-story className={styles.story}>
      <div className={styles.sequence}>
        <section data-market-scene="flow" className={styles.scene} aria-labelledby="home-flow-title">
          <div className={styles.stage}>
            <header className={styles.flowHeader}>
              <div>
                <p className={styles.kicker}>Company financials</p>
                <h2 id="home-flow-title">Where revenue goes</h2>
                <p>Follow sales through costs and taxes to what the business keeps or returns to shareholders.</p>
              </div>
              <Link href="/stocks/AAPL/financials" prefetch={false} className={styles.link}>
                Explore company financials <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </header>
            <RevenueFlow />
          </div>
        </section>
        <HomeMarketChanges />
        <section data-market-scene="relationships" className={styles.scene} aria-labelledby="home-relationships-title">
          <div className={styles.stage}>
            <header className={styles.copy}>
              <p className={styles.kicker}>Company relationships</p>
              <h2 id="home-relationships-title">What moves together</h2>
              <p>Start with one company. The closer a neighbour sits, the more closely their prices move together.</p>
              <Link href="/stocks/NVDA/relationships" prefetch={false} className={styles.link}>
                Explore Nvidia’s relationships <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </header>
            <RelationshipField />
          </div>
        </section>
        <section data-market-scene="atlas" className={styles.scene} aria-labelledby="home-atlas-title">
          <div className={styles.stage}>
            <HomeAtlasPreview>
              <MarketClusters />
            </HomeAtlasPreview>
          </div>
        </section>
      </div>
    </div>
  )
}
