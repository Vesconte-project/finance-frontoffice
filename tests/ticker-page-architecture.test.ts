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
  const relationshipField = readRepoFile('components/stocks/TickerRelationshipField.tsx')
  const relationshipFieldStyles = readRepoFile('components/stocks/TickerRelationshipField.module.css')

  for (const label of ['Overview', 'Fundamentals', 'Financials', 'Valuation', 'Signals', 'Events', 'Relationships', 'Profile', 'Ownership & Capital', 'AI Research', 'Methodology']) assert.match(navigation, new RegExp(`label: '${label.replace(/[&]/g, '\\&')}'`))
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
  assert.doesNotMatch(overview, /TickerRelationshipField|StockTickerIdentity|data-ticker-hero/)
  assert.match(identity, /data-selected-ticker-node/)
  assert.match(identity, /data-selected-ticker-anchor/)
  assert.match(compactChrome, /TickerRelationshipField/)
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
  assert.match(relationshipField, /data-projection="focused-3d"/)
  assert.match(relationshipField, /data-anchor-source="selected-ticker-node"/)
  assert.match(relationshipField, /fibonacciPoint/)
  assert.match(relationshipField, /rotateFieldPoint/)
  assert.match(relationshipField, /ambient-field/)
  assert.match(relationshipField, /motifFrequency/)
  assert.doesNotMatch(relationshipField, /createLinearGradient/)
  assert.match(relationshipField, /continuationPoints/)
  assert.match(relationshipField, /context\.fillStyle = palette\.node/)
  assert.doesNotMatch(relationshipField, /context\.fillStyle = palette\.accent/)
  assert.match(relationshipField, /gsap\.to\(focus/)
  assert.doesNotMatch(relationshipField, /ScrollTrigger|Lenis/)
  assert.doesNotMatch(relationshipFieldStyles, /circle at 3% 8%/)
  assert.match(overview, /label="Technicals"/)
  assert.match(overview, /label="Fundamentals"/)
  assert.match(overview, />Relationships</)
  assert.match(overview, /label: 'Summary'/)
  assert.match(overview, /label: 'Oscillators'/)
  assert.match(overview, /label: 'Moving averages'/)
  assert.match(overview, /data-overview-grade/)
  assert.match(overview, /ScorecardDisc/)
  assert.match(overview, /Current research snapshot/)
  assert.match(overview, /data-relationship-topology/)
  assert.match(overview, /formatRelationshipStrength/)
  assert.match(overview, /formatConfidence/)
  assert.doesNotMatch(overview, /relationship-orbit-preview|GradeRing/)
  assert.doesNotMatch(overview, /navigationSlot|watchlistSlot/)
  assert.match(overview, /orderedFundamentalGroups\.slice\(0, 6\)/)
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
  assert.match(relationships, /Strength = closer, larger, thicker/)
  assert.match(relationships, /Confidence = clearer/)
  assert.match(relationships, /confidenceProminence/)
  assert.match(relationships, /data-company-name/)
  assert.match(relationships, /data-relationship-node/)
  assert.match(relationships, /data-relationship-card/)
  assert.match(relationships, /aria-pressed/)
  assert.match(relationships, /RelationshipConnections/)
  assert.match(relationships, /RelationshipComparisonChart/)
  assert.match(relationships, /DEFAULT_LAYER_RENDER_LIMIT = 50/)
  assert.match(relationships, /sectorColor/)
  assert.match(relationships, /requestAnimationFrame/)
  assert.match(comparison, /separate vertical scales/)
  assert.match(comparison, /Overlaid paths use separate vertical scales/)
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
  assert.match(readRepoFile('app/(app)/stocks/[ticker]/profile/page.tsx'), /StockProfileResearch/)
  assert.match(readRepoFile('app/(app)/stocks/[ticker]/fundamentals/page.tsx'), /StockFundamentalsResearch/)
  assert.match(readRepoFile('app/(app)/stocks/[ticker]/financials/page.tsx'), /StockFinancialsResearch/)
})

test('Phase 2 research views preserve local state and do not simulate statement data', () => {
  const navigation = readRepoFile('components/stocks/StockResearchNav.tsx')
  const tabs = readRepoFile('components/stocks/StockTabsAuto.tsx')
  const shell = readRepoFile('components/stocks/ResearchViewShell.tsx')
  const profile = readRepoFile('components/stocks/StockProfileResearch.tsx')
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
  assert.match(profile, /Fund Profile/)
  assert.match(profile, /Company Profile/)
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
  assert.match(valuation, /TemporalLineChart/)
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
  // A small disc with the grade beside it; the axis names are page text, one
  // button per axis (the slices answer to pointers). Meaning waits for ENG-155 / ENG-157.
  assert.match(overview, /onSelectAxis=/)
  assert.match(overview, /showLabels=\{false\}/)
  assert.match(overview, /slicesFocusable=\{false\}/)
  assert.match(overview, /data-axis-list/)
  assert.match(overview, /aria-pressed=\{selectedAxis === axis\.key\}/)
  assert.match(disc, /slicesFocusable/)
  assert.match(disc, /onKeyDown/)
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
  assert.match(financialsPage, /incomeSeries/)
  // The statement tables and the history by plan were removed (founder, 2026-10-04).
  assert.doesNotMatch(financialsPage, /cutStatementHistory|tierFor|searchParams/)

  // Nothing is derived from two reported values: no subtraction between line
  // items, no ratio and no growth in the reading layer.
  assert.doesNotMatch(reading, /\.value\s*[-/]\s*[\w.]+\.value|growth\s*=|yoy/i)
})
