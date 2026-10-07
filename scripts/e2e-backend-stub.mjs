/**
 * Deterministic fixture backend for browser QA.
 *
 * The Market Universe page fetches its atlas server-side, so a Playwright
 * page.route() mock cannot reach it. This serves the relationship endpoints
 * from repository-owned synthetic data, an explicitly empty Picks ranking
 * needed by the homepage smoke test, and three synthetic ticker pages. Browser QA needs no external backend
 * infrastructure or credentials.
 *
 * Every other path answers 503, which is what the app already sees when no
 * backend is reachable. That keeps the unrelated specs on the behaviour they
 * were written against.
 */
import { createServer } from 'node:http'
import {
  atlasFixture,
  communityFixture,
  neighborhoodFixture,
  tickerIndexFixture,
} from '../e2e/fixtures/market-atlas.mjs'
import {
  isFixtureTicker,
  tickerCorporateActionsFixture,
  tickerDisclosuresFixture,
  tickerEquityCapitalEventsFixture,
  tickerEventsFixture,
  tickerFinancialStatementsFixture,
  tickerHistoryFixture,
  tickerMarketMetricsFixture,
  tickerOhlcFixture,
  tickerSummaryFixture,
} from '../e2e/fixtures/ticker-page.mjs'

const HOST = '127.0.0.1'
const PORT = Number(process.env.E2E_BACKEND_STUB_PORT || 3101)

const ATLAS_VIEWS = new Set(['market', 'residual', 'timing', 'theme'])

function readView(params) {
  const view = params.get('view')
  return view && ATLAS_VIEWS.has(view) ? view : 'market'
}

function readWindow(params) {
  return params.get('window') === '126' ? 126 : 252
}

function send(response, status, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const window = readWindow(url.searchParams)
  const view = readView(url.searchParams)

  if (path === '/health') {
    send(response, 200, { status: 'ok', fixture: true })
    return
  }

  // Every page renders the header search, which loads this once. Serving it
  // keeps the browser console clean without weakening any assertion.
  if (path === '/tickers/index') {
    send(response, 200, tickerIndexFixture())
    return
  }

  // Homepage reads all three rankings server-side. A successful empty fixture
  // keeps the smoke test focused on layout and unexpected console errors;
  // Picks data and entitlement behavior are tested separately.
  if (path === '/screener/rankings' && ['longTerm', 'income', 'shortTerm'].includes(url.searchParams.get('reading'))) {
    send(response, 200, {
      asOf: null,
      reading: url.searchParams.get('reading'),
      filters: { minCoverage: 0, eligibility: null, includeNonCompanies: false, nonCompanyRule: null },
      items: [],
    })
    return
  }

  // A company's standing in each ranking; free on the ticker page.
  const readingsMatch = path.match(/^\/tickers\/([^/]+)\/readings$/)
  if (readingsMatch) {
    send(response, 200, {
      ticker: decodeURIComponent(readingsMatch[1]).toUpperCase(),
      asOf: '2026-10-03',
      readings: [
        { reading: 'longTerm', status: 'ranked', standing: { position: 42, universeSize: 684 }, absenceReason: null },
        { reading: 'income', status: 'ranked', standing: { position: 310, universeSize: 500 }, absenceReason: null },
        { reading: 'shortTerm', status: 'absent', standing: null, absenceReason: 'insufficient_coverage' },
      ],
    })
    return
  }

  if (path === '/network/atlas') {
    send(response, 200, atlasFixture(window, view))
    return
  }

  const community = path.match(/^\/network\/communities\/([^/]+)$/)
  if (community) {
    const payload = communityFixture(decodeURIComponent(community[1]), window, view)
    if (!payload) {
      send(response, 404, { error: 'fixture_community_not_found' })
      return
    }
    send(response, 200, payload)
    return
  }

  // Synthetic ticker pages (QAS, QAM, QAL) for hero layout checks. Real symbols
  // stay unavailable, as before.
  const eventsRoute = path.match(/^\/tickers\/([^/]+)\/events$/)
  if (eventsRoute && isFixtureTicker(decodeURIComponent(eventsRoute[1]))) {
    send(response, 200, tickerEventsFixture(decodeURIComponent(eventsRoute[1])))
    return
  }

  const statementsRoute = path.match(/^\/tickers\/([^/]+)\/financial-statements$/)
  if (statementsRoute && isFixtureTicker(decodeURIComponent(statementsRoute[1]))) {
    send(response, 200, tickerFinancialStatementsFixture(decodeURIComponent(statementsRoute[1]), url.searchParams.get('statementType')))
    return
  }

  const metricsRoute = path.match(/^\/tickers\/([^/]+)\/market-metrics$/)
  if (metricsRoute && isFixtureTicker(decodeURIComponent(metricsRoute[1]))) {
    send(response, 200, tickerMarketMetricsFixture(decodeURIComponent(metricsRoute[1]), url.searchParams.get('metric')))
    return
  }

  const capitalRoute = path.match(/^\/tickers\/([^/]+)\/equity-capital-events$/)
  if (capitalRoute && isFixtureTicker(decodeURIComponent(capitalRoute[1]))) {
    send(response, 200, tickerEquityCapitalEventsFixture(decodeURIComponent(capitalRoute[1])))
    return
  }

  const disclosuresRoute = path.match(/^\/tickers\/([^/]+)\/disclosures$/)
  if (disclosuresRoute && isFixtureTicker(decodeURIComponent(disclosuresRoute[1]))) {
    send(response, 200, tickerDisclosuresFixture(decodeURIComponent(disclosuresRoute[1])))
    return
  }

  const actionsRoute = path.match(/^\/tickers\/([^/]+)\/corporate-actions$/)
  if (actionsRoute && isFixtureTicker(decodeURIComponent(actionsRoute[1]))) {
    send(response, 200, tickerCorporateActionsFixture(decodeURIComponent(actionsRoute[1])))
    return
  }

  const tickerRoute = path.match(/^\/tickers\/([^/]+)\/(summary|ohlc|history)$/)
  if (tickerRoute && isFixtureTicker(decodeURIComponent(tickerRoute[1]))) {
    const ticker = decodeURIComponent(tickerRoute[1])
    const periodDays = url.searchParams.get('period_days')
    if (tickerRoute[2] === 'summary') send(response, 200, tickerSummaryFixture(ticker))
    else if (tickerRoute[2] === 'ohlc') send(response, 200, tickerOhlcFixture(ticker, periodDays))
    else send(response, 200, tickerHistoryFixture(ticker, periodDays))
    return
  }

  const neighborhood = path.match(/^\/network\/neighborhoods\/([^/]+)$/)
  if (neighborhood) {
    const payload = neighborhoodFixture(decodeURIComponent(neighborhood[1]), window, view)
    if (!payload) {
      send(response, 404, { error: 'fixture_neighborhood_not_found' })
      return
    }
    send(response, 200, payload)
    return
  }

  // Anything this fixture does not model stays unavailable on purpose.
  send(response, 503, { error: 'fixture_backend_unavailable', path })
})

server.listen(PORT, HOST, () => {
  console.log(`[e2e-backend-stub] fixture backend listening on http://${HOST}:${PORT}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
