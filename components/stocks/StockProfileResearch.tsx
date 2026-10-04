import type { ReactNode } from 'react'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './ResearchViews.module.css'

function safeWebsite(value: string): string | null {
  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`
    const url = new URL(normalized)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function FactValue({ label, value }: { label: string; value: string }) {
  const website = /website|homepage|url/i.test(label) ? safeWebsite(value) : null
  if (!website) return value
  return <a href={website} target="_blank" rel="noreferrer">{value}</a>
}

/** A profile block whose data is not there yet; `children` names what will appear. */
function DataPending({ children }: { children: ReactNode }) {
  return <BeingBuilt>{children} will appear here.</BeingBuilt>
}

export default function StockProfileResearch({ data }: { data: StockResearchData }) {
  const isFund = data.kind === 'fund'
  const profileTitle = isFund ? 'Fund Profile' : 'Company Profile'
  const visibleFacts = data.profileFacts.slice(0, 12)

  return (
    <ResearchViewShell data={data} title={profileTitle}>
      <section className={styles.profileGrid} aria-labelledby="profile-description">
        <div>
          <h2 id="profile-description" className="sr-only">Description</h2>
          {data.description ? (
            <p className={styles.description}>{data.description}</p>
          ) : (
            <BeingBuilt label={isFund ? 'Fund mandate and objective' : 'Business description'}>
              {isFund ? 'What the fund invests in and why' : 'What the company does'} will appear here.
            </BeingBuilt>
          )}
        </div>
        <aside aria-label={`${profileTitle} facts`}>
          {visibleFacts.length > 0 ? (
            <dl className={styles.facts}>
              {visibleFacts.map((row) => (
                <div key={`${row.label}-${row.value}`}>
                  <dt>{row.label}</dt>
                  <dd><FactValue label={row.label} value={row.value} /></dd>
                </div>
              ))}
            </dl>
          ) : (
            <DataPending>{isFund ? 'Issuer, category and structure' : 'Sector, industry and operating context'}</DataPending>
          )}
        </aside>
      </section>

      {isFund ? (
        <section className={styles.chapterGrid} aria-labelledby="fund-structure">
          <div className={styles.chapterIntro}>
            <h2 id="fund-structure">Portfolio structure</h2>
            <p>Holdings, sector exposure, distributions and risk where covered.</p>
          </div>
          <div className={styles.profileChapters}>
            <article className={styles.profileChapter}>
              <div>
                <h3>Holdings</h3>
                {data.fundamentals.holdings.length ? <p>{`${data.fundamentals.holdings.length} covered`}</p> : null}
              </div>
              <div className={styles.profileChapterContent}>
                {data.fundamentals.holdings.length > 0 ? (
                  <ol className={styles.holdingsList}>
                    {data.fundamentals.holdings.slice(0, 10).map((holding) => (
                      <li className={styles.holding} key={`${holding.symbol}-${holding.name}`}>
                        <strong>{holding.symbol} · {holding.name}</strong>
                        <span>{holding.weightPercent === null ? 'Weight unavailable' : `${holding.weightPercent.toFixed(2)}%`}</span>
                      </li>
                    ))}
                  </ol>
                ) : <DataPending>Holdings and portfolio weights</DataPending>}
              </div>
            </article>
            <article className={styles.profileChapter}>
              <div>
                <h3>Sector exposure</h3>
                {data.fundamentals.sectorWeights.length ? <p>{`${data.fundamentals.sectorWeights.length} sectors`}</p> : null}
              </div>
              <div className={styles.profileChapterContent}>
                {data.fundamentals.sectorWeights.length > 0 ? (
                  <ul className={styles.sectorList}>
                    {data.fundamentals.sectorWeights.slice(0, 10).map((sector) => {
                      const width = Math.max(0, Math.min(100, sector.weightPercent ?? 0))
                      return (
                        <li className={styles.sector} key={sector.sector}>
                          <strong>{sector.sector}</strong>
                          <span>{sector.weightPercent === null ? '—' : `${sector.weightPercent.toFixed(2)}%`}</span>
                          <div className={styles.sectorTrack} aria-hidden="true"><i style={{ width: `${width}%` }} /></div>
                        </li>
                      )
                    })}
                  </ul>
                ) : <DataPending>Sector and industry exposure</DataPending>}
              </div>
            </article>
            <article className={styles.profileChapter}>
              <div>
                <h3>Distributions & risk</h3>
                <p>Current profile fields</p>
              </div>
              <div className={styles.profileChapterContent}>
                {[...data.fundamentals.distributions, ...data.fundamentals.risk].length > 0 ? (
                  <dl className={styles.facts}>
                    {[...data.fundamentals.distributions, ...data.fundamentals.risk].slice(0, 12).map((row) => (
                      <div key={`${row.label}-${row.value}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                    ))}
                  </dl>
                ) : <DataPending>Distribution history and fund risk detail</DataPending>}
              </div>
            </article>
          </div>
        </section>
      ) : (
        <section className={styles.chapterGrid} aria-labelledby="company-context">
          <div className={styles.chapterIntro}>
            <h2 id="company-context">Company context</h2>
            <p>Operating and geographic facts supplied by the current profile.</p>
          </div>
          <div className={styles.profileChapters}>
            <article className={styles.profileChapter}>
              <div><h3>Operations</h3><p>Industry, market and business metadata</p></div>
              <div className={styles.profileChapterContent}>
                {data.profileFacts.length > 12 ? (
                  <dl className={styles.facts}>
                    {data.profileFacts.slice(12).map((row) => (
                      <div key={`${row.label}-${row.value}`}><dt>{row.label}</dt><dd><FactValue label={row.label} value={row.value} /></dd></div>
                    ))}
                  </dl>
                ) : <DataPending>Operating segments and geographic context</DataPending>}
              </div>
            </article>
            <article className={styles.profileChapter}>
              <div><h3>Corporate details</h3><p>Head office, employees and foundation</p></div>
              <DataPending>Additional company profile fields</DataPending>
            </article>
          </div>
        </section>
      )}

      <section className={styles.chapterGrid} aria-labelledby="technical-identifiers">
        <div className={styles.chapterIntro}>
          <h2 id="technical-identifiers">Identifiers</h2>
          <p>Secondary reference fields.</p>
        </div>
        <div className={styles.chapterBody}>
          {data.identifiers.length > 0 ? (
            <dl className={styles.facts}>
              {data.identifiers.map((row) => <div key={`${row.label}-${row.value}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
            </dl>
          ) : <DataPending>ISIN and other reference identifiers</DataPending>}
        </div>
      </section>

      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
