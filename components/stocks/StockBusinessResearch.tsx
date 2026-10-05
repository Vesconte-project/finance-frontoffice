import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import ResearchChapter, { ChapterCard } from '@/components/stocks/research/ResearchChapter'
import type { TickerFinancialRow } from '@/lib/finance'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './ResearchViews.module.css'
import business from './StockBusinessResearch.module.css'

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

function Facts({ rows }: { rows: TickerFinancialRow[] }) {
  return (
    <dl className={styles.facts}>
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`}>
          <dt>{row.label}</dt>
          <dd><FactValue label={row.label} value={row.value} /></dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Business (formerly Profile): how the company works. The description and the
 * profile facts are what the backend reports today. The map of what it buys,
 * makes and sells, and what it depends on, wait on segment, cost and
 * concentration data (ENG-160, ENG-163) and are being built.
 */
function CompanyBusiness({ data }: { data: StockResearchData }) {
  const facts = [...data.profileFacts, ...data.identifiers]
  return (
    <>
      <ResearchChapter
        id="how-it-works"
        label="How the business works"
        lead={data.description ? (
          <p className={business.description} data-business-description="">{data.description}</p>
        ) : (
          <BeingBuilt size="inline">What {data.name} does, in its own words, is being added.</BeingBuilt>
        )}
        aside={facts.length > 0 ? (
          <ChapterCard title="Company facts">
            <Facts rows={facts} />
          </ChapterCard>
        ) : (
          <BeingBuilt label="Company facts">Sector, industry, head office, employees and identifiers are being added.</BeingBuilt>
        )}
      >
        <BeingBuilt size="chart">
          What the company buys, what it makes and who pays for it, business by business and region by region, is being added.
        </BeingBuilt>
      </ResearchChapter>
      <ResearchChapter id="depends-on" label="What it depends on" band>
        <BeingBuilt>
          Its main suppliers, its exposure to energy and other inputs, and how concentrated its customers are, each with the number behind it, are being added.
        </BeingBuilt>
      </ResearchChapter>
    </>
  )
}

/** A fund's business is what it holds; these are the fund fields the backend reports. */
function FundBusiness({ data }: { data: StockResearchData }) {
  const holdings = data.fundamentals.holdings
  const sectors = data.fundamentals.sectorWeights
  const terms = [...data.fundamentals.distributions, ...data.fundamentals.risk]
  const facts = [...data.profileFacts, ...data.identifiers]
  return (
    <>
      <ResearchChapter
        id="what-it-holds"
        label="What the fund holds"
        lead={data.description ? (
          <p className={business.description} data-business-description="">{data.description}</p>
        ) : (
          <BeingBuilt size="inline">What the fund invests in, and why, is being added.</BeingBuilt>
        )}
        aside={facts.length > 0 ? (
          <ChapterCard title="Fund facts"><Facts rows={facts} /></ChapterCard>
        ) : (
          <BeingBuilt label="Fund facts">Issuer, category, structure and identifiers are being added.</BeingBuilt>
        )}
      >
        {holdings.length > 0 ? (
          <ol className={styles.holdingsList} aria-label="Largest holdings">
            {holdings.slice(0, 10).map((holding) => (
              <li className={styles.holding} key={`${holding.symbol}-${holding.name}`}>
                <strong>{holding.symbol} · {holding.name}</strong>
                {holding.weightPercent === null ? null : <span>{`${holding.weightPercent.toFixed(2)}%`}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <BeingBuilt size="chart">The fund’s holdings and their weights are being added.</BeingBuilt>
        )}
      </ResearchChapter>
      <ResearchChapter id="exposure" label="Sector exposure" band>
        {sectors.length > 0 ? (
          <ul className={styles.sectorList}>
            {sectors.slice(0, 10).map((sector) => {
              const width = Math.max(0, Math.min(100, sector.weightPercent ?? 0))
              return (
                <li className={styles.sector} key={sector.sector}>
                  <strong>{sector.sector}</strong>
                  {sector.weightPercent === null ? null : <span>{`${sector.weightPercent.toFixed(2)}%`}</span>}
                  <div className={styles.sectorTrack} aria-hidden="true"><i style={{ width: `${width}%` }} /></div>
                </li>
              )
            })}
          </ul>
        ) : (
          <BeingBuilt>The fund’s sector and industry exposure is being added.</BeingBuilt>
        )}
      </ResearchChapter>
      <ResearchChapter id="distributions-risk" label="Distributions and risk">
        {terms.length > 0 ? <Facts rows={terms} /> : <BeingBuilt>Distribution history and the fund’s risk detail are being added.</BeingBuilt>}
      </ResearchChapter>
    </>
  )
}

export default function StockBusinessResearch({ data }: { data: StockResearchData }) {
  return (
    <ResearchViewShell data={data} title="Business" showHeader={false}>
      <div className={business.chapters} data-business="">
        {data.kind === 'fund' ? <FundBusiness data={data} /> : <CompanyBusiness data={data} />}
      </div>
      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
