import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function walkRuntimeFiles(relativeDir: string): string[] {
  const directory = path.join(process.cwd(), relativeDir)
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) return walkRuntimeFiles(relativePath)
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [relativePath] : []
  })
}

test('ticker navigation exposes a stable horizontal Research hierarchy', () => {
  const navigation = readRepoFile('components/stocks/stock-nav-config.ts')
  const navigationComponent = readRepoFile('components/stocks/StockResearchNav.tsx')
  const navigationStyles = readRepoFile('components/stocks/StockResearchNav.module.css')
  const overview = readRepoFile('components/stocks/StockOverviewClient.tsx')
  const identity = readRepoFile('components/stocks/StockTickerIdentity.tsx')
  const compactChrome = readRepoFile('components/stocks/StockTickerChrome.tsx')
  const tickerLayout = readRepoFile('app/(app)/stocks/[ticker]/layout.tsx')
  const tickerLayoutStyles = readRepoFile('app/(app)/stocks/[ticker]/StockTickerLayout.module.css')
  const tickerLoading = readRepoFile('app/(app)/stocks/[ticker]/loading.tsx')
  const researchLoading = readRepoFile('components/stocks/TickerResearchLoading.tsx')
  const researchLoadingStyles = readRepoFile('components/stocks/TickerResearchLoading.module.css')
  const loadingPulse = readRepoFile('components/ui/LoadingPulse.tsx')
  const loadingPulseStyles = readRepoFile('components/ui/LoadingPulse.module.css')
  const tickerUniverse = readRepoFile('components/stocks/TickerUniverse.tsx')

  for (const label of ['Overview', 'Fundamentals', 'Financials', 'Valuation', 'Signals', 'Events', 'Relationships', 'Business', 'Ownership & Capital', 'AI Research', 'Methodology']) assert.match(navigation, new RegExp(`label: '${label.replace(/[&]/g, '\\&')}'`))
  assert.doesNotMatch(navigation, /subitems|stockResearchMoreItems|Income Statement|Balance Sheet|Cash Flow|Signal History|Indicator Details/)
  assert.doesNotMatch(navigation, /label: 'Lens'/)
  assert.doesNotMatch(navigationComponent, /button|menu|More|chevron|ArrowDown|Escape|useSearchParams/)
  assert.match(navigationComponent, /activeRail/)
  assert.match(navigationStyles, /\.root::after/)
  assert.match(navigationStyles, /\.activeRail/)
  assert.match(navigationStyles, /prefers-reduced-motion: reduce/)
  assert.match(overview, /id="fundamentals"/)
  assert.match(overview, /id="signals"/)
  assert.match(overview, /id="relationships"/)
  assert.doesNotMatch(overview, /TickerUniverse|StockTickerIdentity|data-ticker-hero/)
  assert.match(identity, /data-selected-ticker-node/)
  assert.match(identity, /data-selected-ticker-anchor/)
  assert.doesNotMatch(compactChrome, /TickerRelationshipField/)
  assert.match(tickerLayout, /TickerUniverse/)
  assert.match(compactChrome, /StockTickerIdentity/)
  assert.match(compactChrome, /StockResearchNav/)
  assert.match(compactChrome, /data-ticker-chrome="ready"/)
  assert.match(tickerLayout, /getStockTickerChromeData/)
  assert.match(tickerLayout, /StockTabsAuto/)
  assert.match(tickerLayout, /params\.then/)
  assert.doesNotMatch(tickerLayout, /export default async function|await params/)
  assert.doesNotMatch(tickerLayout, /StockTickerChromeFallback|Suspense/)
  assert.match(tickerLayoutStyles, /margin-top: calc\(var\(--ticker-header-offset\) \* -1\)/)
  assert.match(tickerLayoutStyles, /app-header__inner/)
  assert.match(tickerLoading, /TickerResearchLoading/)
  assert.doesNotMatch(tickerLoading, /Skeleton|Card|animate-pulse/)
  assert.match(researchLoading, /ResearchViewShell/)
  assert.match(researchLoading, /LoadingPulse/)
  assert.doesNotMatch(researchLoading, /Resolving evidence|Gathering evidence|Building the next research view|<svg|<path/)
  assert.match(researchLoadingStyles, /120ms/)
  assert.match(researchLoadingStyles, /prefers-reduced-motion: reduce/)
  assert.match(loadingPulse, /data-loading-pulse/)
  assert.match(loadingPulse, /role="status"/)
  assert.match(loadingPulseStyles, /loading-point-phase/)
  assert.match(loadingPulseStyles, /prefers-reduced-motion: reduce/)
  assert.match(compactChrome, /loading/)
  assert.doesNotMatch(overview, /selectedConnector/)
  // The universe behind the band turns around the selected ticker's own node.
  assert.match(tickerUniverse, /data-ticker-universe/)
  assert.match(tickerUniverse, /data-selected-ticker-anchor/)
  assert.match(tickerUniverse, /reducedMotion/)
  assert.match(overview, /label="Technicals"/)
  assert.match(overview, /label="Fundamentals"/)
  assert.match(overview, /label="Relationships"/)
  assert.match(overview, /label: 'Summary'/)
  assert.match(overview, /label: 'Oscillators'/)
  assert.match(overview, /label: 'Moving averages'/)
  assert.match(overview, /data-overview-grade/)
  assert.match(overview, /ScorecardDisc/)
  assert.match(overview, /Current research snapshot/)
  // Relationships (Spec PRD-78): ticker, name, "Moves with it", strength as a bar, today's change; no confidence, no dashes.
  assert.match(overview, /Moves with it/)
  assert.match(overview, /data-strength-bar/)
  assert.doesNotMatch(overview, /Confidence|formatConfidence|data-relationship-topology/)
  assert.doesNotMatch(overview, /relationship-orbit-preview|GradeRing/)
  assert.doesNotMatch(overview, /navigationSlot|watchlistSlot/)
  assert.match(overview, /data-fundamental-cards/)
  assert.doesNotMatch(overview, /snapshotAxes|snapshotAxisLabels|Why this grade\?|Shared across perspectives|Canonical grade/)
  assert.doesNotMatch(overview, /Is now a good moment|Is the business attractive|What is moving with it|What shapes this asset/)
  assert.doesNotMatch(overview, /Continue researching|Go deeper|Lens score/)
  assert.doesNotMatch(overview, /strokeDasharray=.*clamped/)
  assert.doesNotMatch(overview, /View fundamental details|SignalFlowStream|SignalDistributionBubbleCluster|RegimeHistoryChart/)
  assert.doesNotMatch(overview, /AiAnalystPanel|Research Copilot/)
})

test('the retired perspective system is absent and its motion survives as a generic selector', () => {
  const overview = readRepoFile('components/stocks/StockOverviewClient.tsx')
  const selector = readRepoFile('components/ui/ExpandingSelector.tsx')
  const runtime = ['app', 'components', 'lib']
    .flatMap(walkRuntimeFiles)
    .map(readRepoFile)
    .join('\n')

  assert.match(selector, /role="radiogroup"/)
  assert.match(selector, /role="radio"/)
  assert.match(selector, /wrapIndex/)
  assert.match(selector, /Previous view:/)
  assert.match(selector, /Next view:/)
  assert.match(selector, /onPointerMove/)
  assert.match(selector, /ArrowRight/)
  assert.match(selector, /onValueChange/)
  assert.doesNotMatch(selector, /usePathname|useRouter|useSearchParams|window\.history|investment/i)
  assert.doesNotMatch(runtime, /investment-lens|PerspectiveDial|ResearchPerspectiveControl|data-perspective-dial/)
  assert.doesNotMatch(overview, /initialLens|data-lens|lensScore/)
})

test('Relationships uses the shared expanding selector and an accessible focused constellation', () => {
  const relationships = readRepoFile('components/RelationshipOrbit.tsx')
  const comparison = readRepoFile('components/RelationshipComparisonChart.tsx')
  const styles = readRepoFile('components/RelationshipOrbit.module.css')
  const page = readRepoFile('app/(app)/stocks/[ticker]/relationships/page.tsx')
  const comparisonRoute = readRepoFile('app/api/stocks/relationship-comparison/route.ts')

  assert.match(relationships, /ExpandingSelector/)
  assert.match(relationships, /SegmentedControl/)
  assert.match(relationships, /label="View"/)
  assert.match(relationships, /Moves independently/)
  // Global rules (Spec PRD-78): a chapter, no loose legend, no summary or
  // footnote, no internal language, no cards repeating the map, no dashes.
  assert.match(relationships, /<ResearchChapter/)
  assert.doesNotMatch(relationships, /Strength = closer|How to read|mapLegend|Dataset |DiscoveryCards|data-relationship-card|'—'/)
  assert.doesNotMatch(page, /relationship endpoint|How to read relationships|Coverage:|methodology#relationships/)
  assert.match(readRepoFile('components/stocks/StockMethodologyResearch.tsx'), /id="relationships"/)
  assert.doesNotMatch(styles, /@media \(max-width/)
  assert.match(relationships, /confidenceProminence/)
  assert.match(relationships, /data-company-name/)
  assert.match(relationships, /data-relationship-node/)
  assert.match(relationships, /aria-pressed/)
  assert.match(relationships, /RelationshipConnections/)
  assert.match(relationships, /RelationshipComparisonChart/)
  assert.match(relationships, /DEFAULT_LAYER_RENDER_LIMIT = 50/)
  assert.match(relationships, /sectorColor/)
  assert.match(relationships, /requestAnimationFrame/)
  // Both lines on one scale, each named at its end: no legend and no caveat needed.
  assert.doesNotMatch(comparison, /separate vertical scales|styles\.legend/)
  assert.match(comparison, /endLabel/)
  assert.match(comparisonRoute, /getHistoricalData/)
  assert.match(comparisonRoute, /Two different valid ticker symbols are required/)
  assert.doesNotMatch(relationships, /NetworkGraphCanvas|FilterChip/)
  assert.match(relationships, /formatConfidence/)
  assert.doesNotMatch(relationships, /probability|relationshipConfidence/i)
  assert.match(styles, /prefers-reduced-motion: reduce/)
  assert.match(page, /RelationshipOrbit/)
  assert.match(page, /showHeader=\{false\}/)
  assert.doesNotMatch(page, /RelationshipsList/)
})

test('legacy ticker detail routes resolve to stable research destinations', () => {
  const expectedRedirects: Array<[string, string]> = [
    ['app/(app)/stocks/[ticker]/financials/[statement]/page.tsx', '/financials'],
    ['app/(app)/stocks/[ticker]/holdings-dividends/page.tsx', '/fundamentals'],
    ['app/(app)/stocks/[ticker]/signal-history/page.tsx', '/signals'],
    ['app/(app)/stocks/[ticker]/performance/page.tsx', '/signals'],
  ]

  for (const [file, anchor] of expectedRedirects) {
    const source = readRepoFile(file)
    assert.match(source, /permanentRedirect/)
    assert.ok(source.includes(anchor), `${file} should redirect to ${anchor}`)
  }
  // Profile was renamed Business (Spec PRD-78); the old path redirects.
  assert.match(readRepoFile('app/(app)/stocks/[ticker]/profile/page.tsx'), /permanentRedirect\(`\/stocks\/\$\{ticker\.toUpperCase\(\)\}\/business`\)/)
  assert.match(readRepoFile('app/(app)/stocks/[ticker]/business/page.tsx'), /StockBusinessResearch/)
  assert.match(readRepoFile('app/(app)/stocks/[ticker]/fundamentals/page.tsx'), /StockFundamentalsResearch/)
  assert.match(readRepoFile('app/(app)/stocks/[ticker]/financials/page.tsx'), /StockFinancialsResearch/)
})

test('Phase 2 research views preserve local state and do not simulate statement data', () => {
  const navigation = readRepoFile('components/stocks/StockResearchNav.tsx')
  const tabs = readRepoFile('components/stocks/StockTabsAuto.tsx')
  const shell = readRepoFile('components/stocks/ResearchViewShell.tsx')
  const business = readRepoFile('components/stocks/StockBusinessResearch.tsx')
  const fundamentals = readRepoFile('components/stocks/StockFundamentalsResearch.tsx')
  const researchLoadingView = readRepoFile('components/stocks/TickerResearchLoading.tsx')
  const navConfig = readRepoFile('components/stocks/stock-nav-config.ts')
  const financials = readRepoFile('components/stocks/StockFinancialsResearch.tsx')
  const overviewLink = readRepoFile('components/stocks/ResearchOverviewLink.tsx')
  const contract = readRepoFile('docs/features/ticker-research-views.md')

  assert.match(navigation, /stockResearchHref\(ticker, item\)/)
  assert.match(navigation, /aria-label="Ticker research"/)
  assert.match(navigation, /scrollTo/)
  assert.match(navigation, /activeRail/)
  assert.doesNotMatch(navigation, /ArrowDown|Escape|aria-haspopup|role="menu"/)
  assert.doesNotMatch(navigation, /Perspective|Company & fund|Market evidence/)
  assert.doesNotMatch(tabs, /useSearchParams|parseInvestmentLens/)
  assert.match(tabs, /StockTickerChrome/)
  assert.match(tabs, /StockTickerChromeFallback/)
  assert.match(tabs, /Suspense/)
  assert.doesNotMatch(shell, /Research breadcrumb|assetContext/)
  assert.match(business, /label="How the business works"/)
  assert.match(business, /label="What it depends on"/)
  assert.match(business, /label="What the fund holds"/)
  assert.match(fundamentals, /FundChapters/)
  assert.doesNotMatch(fundamentals, /Math\.random|mock|fake/i)
  assert.doesNotMatch(fundamentals, /Data pending|trendPlaceholder/)
  // The tab and the ticker chrome already name this page; a heading repeating
  // the tab beside a coverage badge told the reader nothing.
  assert.match(fundamentals, /showHeader=\{false\}/)
  // A view with no page header must not grow one while it loads.
  assert.match(navConfig, /key: 'fundamentals'[^}]*loadingTitle: ''/)
  assert.doesNotMatch(researchLoadingView, /=== 'overview'/)
  assert.match(financials, /showHeader=\{false\}/)
  assert.match(navConfig, /key: 'financials'[^}]*loadingTitle: ''/)
  assert.doesNotMatch(financials, /Math\.random|mock|fake/i)
  assert.match(overviewLink, /href=\{`\/stocks\/\$\{ticker\}`\}/)
  assert.doesNotMatch(overviewLink, /searchParams|lens/)
  assert.match(contract, /canonical financial statement contract/i)
})

test('canonical research views use shared ticker-scoped backend contracts', () => {
  const helper = readRepoFile('lib/canonical-research.ts')
  const financialsPage = readRepoFile('app/(app)/stocks/[ticker]/financials/page.tsx')
  const eventsPage = readRepoFile('app/(app)/stocks/[ticker]/events/page.tsx')
  const valuationPage = readRepoFile('app/(app)/stocks/[ticker]/valuation/page.tsx')
  const overview = readRepoFile('components/stocks/StockOverviewClient.tsx')
  const valuation = readRepoFile('components/stocks/StockValuationResearch.tsx')
  const temporalChart = readRepoFile('components/charts/TemporalLineChart.tsx')
  const temporalChartStyles = readRepoFile('components/charts/TemporalLineChart.module.css')

  assert.match(helper, /import 'server-only'/)
  assert.match(helper, /\/tickers\/\$\{encodeURIComponent\(ticker\)\}\/financial-statements/)
  assert.match(helper, /\/tickers\/\$\{encodeURIComponent\(ticker\)\}\/market-metrics/)
  assert.match(helper, /\/tickers\/\$\{encodeURIComponent\(ticker\)\}\/events/)
  assert.match(helper, /\/tickers\/\$\{encodeURIComponent\(ticker\)\}\/disclosures/)
  assert.doesNotMatch(helper, /\/analyst\//)
  assert.match(financialsPage, /getTickerFinancialStatements/)
  assert.match(eventsPage, /getTickerEvents/)
  assert.match(eventsPage, /getTickerDisclosures/)
  assert.match(valuationPage, /getTickerMarketMetrics/)
  assert.match(overview, /TemporalLineChart/)
  assert.match(valuation, /MultiplesChapter/)
  assert.doesNotMatch(valuation, /observationRow/)
  assert.match(temporalChart, /data-temporal-line-chart/)
  assert.match(temporalChart, /showRangeChange/)
  assert.match(temporalChartStyles, /animation: draw-line/)
  assert.match(temporalChartStyles, /prefers-reduced-motion: reduce/)
})

test('frontoffice runtime contains no direct Yahoo or Supabase client path', () => {
  const source = ['app', 'components', 'lib']
    .flatMap(walkRuntimeFiles)
    .map(readRepoFile)
    .join('\n')

  assert.doesNotMatch(source, /@supabase\/supabase-js|createClient\s*\([^)]*SUPABASE/s)
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE/)
  assert.doesNotMatch(source, /query[12]\.finance\.yahoo\.com|searchYahoo|YahooSearch/)
})

test('the Overview follows the accepted ticker Spec (PRD-78): order, Being built blocks and the Events layer', () => {
  const overview = readRepoFile('components/stocks/StockOverviewClient.tsx')
  const page = readRepoFile('app/(app)/stocks/[ticker]/page.tsx')
  const dialog = readRepoFile('components/stocks/ExpandedChartDialog.tsx')
  const disc = readRepoFile('components/stocks/ScorecardDisc.tsx')

  // Under the chart: market cap and next earnings only.
  assert.doesNotMatch(overview, /30D volatility|volatility30d/)
  // Chapter order below the hero.
  const order = ['{sinceSection}', '{timingSection}', '{questionsSection}', '{fundamentalsSection}', '{relationshipsSection}'].map((token) => overview.indexOf(token))
  assert.ok(order.every((index) => index > 0), 'every chapter is rendered')
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'chapters follow the Spec order')
  assert.match(overview, /label="Since your last visit"/)
  assert.match(overview, /label="Questions worth asking"/)
  // Signals do not mix with Technicals; the model signal stays beside the chart.
  assert.doesNotMatch(overview, /Signal & events|Catalysts/)
  assert.match(overview, /Key readings · \$\{signalTimeframe\}/)
  // The disc's slices are its buttons (keyboard and pointer), with the axis names
  // written around it as page text; no chips duplicate them (Spec: "não duplicar
  // com chips"). Meaning waits for ENG-155 / ENG-157.
  assert.match(overview, /onSelectAxis=/)
  assert.match(overview, /textLabels/)
  assert.doesNotMatch(overview, /slicesFocusable=\{false\}|data-axis-list|axisChip/)
  assert.match(disc, /slicesFocusable = true/)
  assert.match(disc, /onKeyDown/)
  assert.doesNotMatch(disc, />\s*–\s*</, 'no dash in a slice without a score')
  // Only what the Spec places beside the chart: the score and the two verdict lines.
  assert.doesNotMatch(overview, /readingVerdicts|How the score works|regime'/)
  // The hero lays out by its own width: a 300px detail column (340px when wide).
  const overviewStyles = readRepoFile('components/stocks/StockOverviewClient.module.css')
  assert.match(overviewStyles, /@container overview-lead \(min-width: 56rem\)[\s\S]*18\.75rem/)
  assert.match(overviewStyles, /@container overview-lead \(min-width: 72rem\)[\s\S]*21\.25rem/)
  assert.match(overviewStyles, /@container hero-chart \(max-width: 519px\)/)
  assert.doesNotMatch(overviewStyles, /wrap-reverse/)
  // Fundamentals cards: reported revenue bars from the same series as the tab; display-face numbers.
  assert.match(page, /annualSeries\(income\.rows, 'revenue'\)/)
  assert.match(overview, /MiniBars/)
  assert.match(overviewStyles, /\.fundamentalValue strong \{[^}]*font-display/)
  assert.doesNotMatch(overview, /Financial statements →|Valuation history →|Ownership & capital →/)
  // Events are fetched without blocking the page and drawn only in the expanded chart.
  assert.match(page, /chartEventsPromise/)
  assert.doesNotMatch(page, /await chartEventsPromise/)
  assert.match(dialog, /data-events-toggle/)
  assert.match(dialog, /useState\(false\)[\s\S]*setShowEvents|const \[showEvents, setShowEvents\] = useState\(false\)/)
  // Values are never derived here: net cash only when the summary supplies it.
  assert.doesNotMatch(overview, /cash\s*-\s*debt|totalCash\s*-/i)
})

test('Fundamentals and Financials follow the accepted ticker Spec (PRD-78, phase 3): reported values only', () => {
  const fundamentals = readRepoFile('components/stocks/StockFundamentalsResearch.tsx')
  const revenue = readRepoFile('components/stocks/fundamentals/RevenueChapter.tsx')
  const flow = readRepoFile('components/stocks/financials/SalesFlowChapter.tsx')
  const flowStyles = readRepoFile('components/stocks/financials/Financials.module.css')
  const reading = readRepoFile('lib/statement-reading.ts')
  const fundamentalsPage = readRepoFile('app/(app)/stocks/[ticker]/fundamentals/page.tsx')
  const financialsPage = readRepoFile('app/(app)/stocks/[ticker]/financials/page.tsx')

  // Fundamentals chapters in the Spec's order.
  const order = ['<RevenueChapter', '<OperatingMarginChapter', '<CashAndDebtChapter', '<DividendsChapter'].map((token) => fundamentals.indexOf(token))
  assert.ok(order.every((index) => index > 0), 'every Fundamentals chapter is rendered')
  assert.deepEqual([...order].sort((a, b) => a - b), order)
  assert.match(revenue, /id="revenue"/)
  assert.match(fundamentals, /id="operating-margin"/)
  assert.match(fundamentals, /id="cash-and-debt"/)
  assert.match(fundamentals, /id="dividends"/)
  // Growth is the backend's (ENG-170): the "% growth" view is Being built.
  assert.match(revenue, /'% growth'/)
  assert.doesNotMatch(revenue, /Math\.pow|\*\* \(1 \//)
  // Operating margin: the card is "Since {year}" and the net margin is the chapter's footer.
  assert.match(fundamentals, /`Since \$\{sinceYear\}`/)
  assert.match(fundamentals, /data-net-margin/)
  assert.doesNotMatch(fundamentals, /What moved the margin|title="Net margin"/)
  assert.match(fundamentals, /Ownership & Capital →/)
  // Dividends are reported payments from corporate actions.
  assert.match(fundamentalsPage, /getTickerCorporateActions/)
  assert.match(fundamentalsPage, /dividendHistory/)

  // Financials: one horizontal flow, with the detail under it.
  assert.match(flow, /label="Where each dollar of sales goes"/)
  assert.match(flow, /data-flow-variant="wide"/)
  assert.match(flow, /data-flow-variant="narrow"/)
  assert.match(flowStyles, /@container sales-flow \(width >= 56\.25rem\)/)
  assert.doesNotMatch(flowStyles, /flex-direction: column[^}]*data-flow-variant|writing-mode/)
  assert.match(flow, /label="Biggest changes"/)
  // The narrow flow's sales bar is named.
  assert.match(flow, /narrowBarLabel/)
  assert.match(financialsPage, /incomeSeries/)
  // The statement tables and the history by plan were removed (founder, 2026-10-04).
  assert.doesNotMatch(financialsPage, /cutStatementHistory|tierFor|searchParams/)

  // Nothing is derived from two reported values: no subtraction between line
  // items, no ratio and no growth in the reading layer.
  assert.doesNotMatch(reading, /\.value\s*[-/]\s*[\w.]+\.value|growth\s*=|yoy/i)
})

test('Valuation follows the accepted ticker Spec (PRD-78, phase 4): reported multiples, the rest being built', () => {
  const valuation = readRepoFile('components/stocks/StockValuationResearch.tsx')
  const multiples = readRepoFile('components/stocks/valuation/MultiplesChapter.tsx')
  const assumes = readRepoFile('components/stocks/valuation/PriceAssumesChapter.tsx')
  const reading = readRepoFile('lib/valuation-reading.ts')
  const page = readRepoFile('app/(app)/stocks/[ticker]/valuation/page.tsx')

  // Chapters in the Spec's order.
  const order = ['<MultiplesChapter', 'id="peers"', '<PriceAssumesChapter', 'id="analysts"'].map((token) => valuation.indexOf(token))
  assert.ok(order.every((index) => index > 0), 'every Valuation chapter is rendered')
  assert.deepEqual([...order].sort((a, b) => a - b), order)
  assert.match(multiples, /label="Multiples, last 10 years"/)
  assert.match(multiples, /title="All four"/)
  assert.match(assumes, /label="What the price assumes"/)
  assert.match(valuation, /label="Against its peers"/)
  assert.match(valuation, /label="What analysts expect"/)
  // The four multiples of "All four", from market metrics.
  for (const metric of ['trailing_pe', 'price_to_sales', 'price_to_free_cash_flow', 'enterprise_value_to_ebitda']) assert.match(reading, new RegExp(metric))
  assert.doesNotMatch(reading, /price_to_book/)
  assert.match(page, /getTickerMarketMetrics/)
  // No statistic or model value is computed here: no median, percentile or
  // discounting; the stepper answers with an explicit message.
  assert.doesNotMatch(reading, /function \w*(median|percentile|quantile|band|discount)/i)
  assert.doesNotMatch(assumes, /Math\.pow|\w \*\* \w/)
  assert.match(assumes, /role="status"/)
})

test('Business and Ownership & Capital follow the accepted ticker Spec (PRD-78, phase 5)', () => {
  const nav = readRepoFile('components/stocks/stock-nav-config.ts')
  const business = readRepoFile('components/stocks/StockBusinessResearch.tsx')
  const ownership = readRepoFile('components/stocks/StockOwnershipResearch.tsx')
  const ownershipPage = readRepoFile('app/(app)/stocks/[ticker]/ownership/page.tsx')
  const capital = readRepoFile('lib/capital-reading.ts')

  // The tab order of the Spec, with Business where Profile was.
  const order = ['Overview', 'Fundamentals', 'Financials', 'Valuation', 'Signals', 'Events', 'Relationships', 'Business', 'Ownership & Capital', 'AI Research', 'Methodology']
    .map((label) => nav.indexOf(`label: '${label}'`))
  assert.ok(order.every((index) => index > 0))
  assert.deepEqual([...order].sort((a, b) => a - b), order)
  assert.doesNotMatch(nav, /label: 'Profile'/)

  // Business: how the business works, then what it depends on.
  assert.ok(business.indexOf('label="How the business works"') < business.indexOf('label="What it depends on"'))

  // Ownership chapters in the Spec's order, with the reported buybacks.
  const chapters = ['id="who-owns"', 'id="insiders"', '<BuybacksChapter', '<PricePaysForChapter', '<PriceHistoryChapter'].map((token) => ownership.indexOf(token))
  assert.ok(chapters.every((index) => index > 0))
  assert.deepEqual([...chapters].sort((a, b) => a - b), chapters)
  assert.match(ownership, /`Buybacks since \$\{SINCE_YEAR\}`/)
  assert.match(ownershipPage, /getTickerEquityCapitalEvents/)
  assert.match(ownershipPage, /buybackExecutions/)
  // Years add up the reported executions and value them at today's price
  // (decision 4), every year from 2016; never across currencies.
  assert.match(capital, /export function buybackSummary/)
  assert.match(ownershipPage, /buybackSummary\(buybacks, [^)]*fromYear: SINCE_YEAR/)
  assert.match(ownershipPage, /singleCurrency/)
  // Founder, 2026-10-05: no snapshot strip (it repeated the market cap), no
  // list of each buyback, one legend; the share balance shows what is reported.
  assert.doesNotMatch(ownership, /CurrentSnapshot|snapshotStrip|Each buyback|Not available/)
  assert.match(ownership, /Bought back/)
  assert.match(ownership, /Shares today/)
  // What the price pays for is a horizontal flow; How the price got here is its
  // own chapter with Years | Quarters and no Play.
  const story = readRepoFile('components/stocks/ownership/PriceStoryChapters.tsx')
  const storyStyles = readRepoFile('components/stocks/ownership/Ownership.module.css')
  assert.match(story, /id="price-pays-for"/)
  assert.match(story, /id="price-got-here"/)
  assert.match(story, /\['Years', 'Quarters'\]/)
  assert.doesNotMatch(story, /Play|setInterval/)
  assert.match(storyStyles, /\.paysFlow \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\) 1\.25rem\) minmax\(0, 1fr\)/)
  assert.doesNotMatch(storyStyles, /writing-mode|flex-direction: column[^}]*paysFlow/)
  assert.doesNotMatch(story, /bridgeFormula|Enterprise value/)
})

test('conformance with the accepted ticker Spec (PRD-78): the items the review found', () => {
  const overview = readRepoFile('components/stocks/StockOverviewClient.tsx')
  const signals = readRepoFile('lib/technicalSignals.ts')
  const dialog = readRepoFile('components/stocks/ExpandedChartDialog.tsx')
  const page = readRepoFile('app/(app)/stocks/[ticker]/page.tsx')
  const layout = readRepoFile('app/(app)/stocks/[ticker]/StockTickerLayout.module.css')
  const chrome = readRepoFile('components/stocks/StockTickerChrome.module.css')
  const flow = readRepoFile('components/stocks/financials/SalesFlowChapter.tsx')
  const nav = readRepoFile('components/stocks/stock-nav-config.ts')
  const methodology = readRepoFile('components/stocks/StockMethodologyResearch.tsx')
  const signalsTab = readRepoFile('components/stocks/StockSignalsResearch.tsx')
  const ask = readRepoFile('components/stocks/ai/AskQuestion.tsx')

  // Questions worth asking: the take buttons are visible and answer explicitly; nothing is saved.
  for (const take of ['Overdone', 'Fair', 'Not sure yet']) assert.match(overview, new RegExp(`'${take}'`))
  assert.match(overview, /Opinions can’t be saved yet\. Saving your take and following how the evidence changes is coming in a later version\./)
  assert.match(overview, />OK</)
  assert.doesNotMatch(overview, /fetch\([^)]*take/i)
  // The hero chart opens on 1Y.
  assert.match(overview, /useState<ChartTimeframe>\('1Y'\)/)
  // Key readings: 50/200 days, 20/40 weeks, 10/20 months.
  assert.match(signals, /'1D': \[50, 200\]/)
  assert.match(signals, /'1W': \[20, 40\]/)
  assert.match(signals, /'1M': \[10, 20\]/)
  // Events layer: the next day's move on the card, guidance markers, insiders being built.
  assert.match(dialog, /nextSessionChange/)
  assert.match(dialog, /data-event-next-day/)
  assert.match(dialog, /Insider trades are being added/)
  assert.match(page, /row\.domain === 'guidance'/)
  // Screens: 1400px maximum, 20px phone margins (14px below 340px).
  for (const css of [layout, chrome]) {
    assert.match(css, /max-width: 1400px/)
    assert.match(css, /max-width: 339\.98px/)
  }
  // Financials: the chosen element's card sits beside the flow on wide screens.
  assert.match(flow, /aside=\{\(\s*<>\s*<NodeCard/)
  // Every tab without a page header has a loading view without one.
  for (const key of ['signals', 'ownership', 'ai-research', 'methodology', 'relationships', 'business']) {
    assert.match(nav, new RegExp(`key: '${key}'[^}]*loadingTitle: ''`))
  }
  // No section numbering, no dashes in place of values, no silent disabled controls.
  assert.doesNotMatch(methodology, />0[0-9]</)
  assert.doesNotMatch(signalsTab, /\?\? '—'|\? '—' :/)
  assert.doesNotMatch(ask, /<(input|button)[^>]*\bdisabled\b/)
})

test('every ticker tab renders without a page header, on the research chapters', () => {
  for (const file of [
    'components/stocks/StockFundamentalsResearch.tsx',
    'components/stocks/StockFinancialsResearch.tsx',
    'components/stocks/StockValuationResearch.tsx',
    'components/stocks/StockSignalsResearch.tsx',
    'components/stocks/StockEventsResearch.tsx',
    'components/stocks/StockBusinessResearch.tsx',
    'components/stocks/StockOwnershipResearch.tsx',
    'components/stocks/StockAiResearch.tsx',
    'components/stocks/StockMethodologyResearch.tsx',
    'app/(app)/stocks/[ticker]/relationships/page.tsx',
  ]) assert.match(readRepoFile(file), /showHeader=\{false\}/, `${file} shows a page header`)
})

test('Signals, Events, Relationships, AI Research and Methodology are research chapters in a fixed order (PRD-78, global rules)', () => {
  const inOrder = (source: string, tokens: string[], name: string) => {
    const positions = tokens.map((token) => source.indexOf(token))
    assert.ok(positions.every((index) => index >= 0), `${name}: every chapter is rendered (${tokens.join(', ')})`)
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, `${name}: chapters follow the set order`)
  }
  const signals = readRepoFile('components/stocks/StockSignalsResearch.tsx')
  const timeline = readRepoFile('components/stocks/signals/SignalTimelineChapter.tsx')
  inOrder(signals, ['<SignalTimelineChapter', 'id="technicals"', 'id="market-context"', 'id="regime-history"', 'id="signal-history"'], 'Signals')
  // Names and numbers are page text over the chart; each signal is a point to pick; no static range pill or loose legend.
  assert.doesNotMatch(signals + timeline, /<text\b|timelineRange|Signal direction legend/)
  assert.match(timeline, /aria-pressed=\{selected === marker\.id\}/)

  const events = readRepoFile('components/stocks/StockEventsResearch.tsx')
  inOrder(events, ['id="next-event"', 'id="calendar"', 'id="reported-against-estimate"', 'id="documents"'], 'Events')
  assert.doesNotMatch(events, /title="Scheduled"|title="Past"|reported twice/)
  const calendarStyles = readRepoFile('components/calendar/EventCalendar.module.css')
  assert.doesNotMatch(calendarStyles, /@media \(max-width/)

  const relationships = readRepoFile('components/RelationshipOrbit.tsx')
  inOrder(relationships, ['id="related-companies"', 'data-relationship-evidence'], 'Relationships')

  const ai = readRepoFile('components/stocks/StockAiResearch.tsx')
  inOrder(ai, ['id="ask"', 'id="brief"'], 'AI Research')
  // A visitor without a session is not shown a plan.
  assert.match(ai, /access\.isSignedIn \?/)

  const methodology = readRepoFile('components/stocks/StockMethodologyResearch.tsx')
  inOrder(methodology, ['id="evidence"', 'id="relationships"', 'id="data"', 'id="coverage"', 'id="limits"', 'id="assets"', 'id="disclosures"'], 'Methodology')
  assert.doesNotMatch(methodology, /How to read Vesconte|The final geometry is reserved|sectionLabel|On this page/)
  // A fund is not scored, so its methodology does not define the score.
  assert.match(methodology, /isFund \? null : <div><strong>Score<\/strong>/)
})
