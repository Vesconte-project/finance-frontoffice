/**
 * Deterministic fixture backend for browser QA.
 *
 * The market atlas page fetches its atlas server-side, so a Playwright
 * page.route() mock cannot reach it. This serves the weekly atlas endpoints
 * from repository-owned synthetic data, an explicitly empty Picks ranking
 * needed by the homepage smoke test, three synthetic ticker pages and a synthetic
 * public calendar. Browser QA needs no external backend
 * infrastructure or credentials.
 *
 * Every other path answers 503, which is what the app already sees when no
 * backend is reachable. That keeps the unrelated specs on the behaviour they
 * were written against.
 */
import { createServer } from 'node:http'
import {
  atlasCompanyFixture,
  atlasOverviewFixture,
  atlasZoneFixture,
  tickerIndexFixture,
} from '../e2e/fixtures/market-atlas.mjs'
import {
  compareFixture,
  influenceFixture,
  movementFixture,
  proCompanyFixture,
  proOverviewFixture,
  testFixture,
  themeFixture,
  themesFixture,
  weeksFixture,
} from '../e2e/fixtures/market-atlas-pro.mjs'
import { calendarFixture } from '../e2e/fixtures/calendar.mjs'
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

  if (path === '/health') {
    send(response, 200, { status: 'ok', fixture: true })
    return
  }

  // Every page renders the header search, which loads this once. Serving it
  // keeps the browser console clean without weakening any assertion.
  if (path === '/v1/tickers/index') {
    send(response, 200, tickerIndexFixture())
    return
  }

  // The public calendar, for whatever range the page asks for.
  if (path === '/v1/calendar' && url.searchParams.get('startDate') && url.searchParams.get('endDate') && !url.searchParams.get('symbol')) {
    send(response, 200, calendarFixture(url.searchParams.get('startDate'), url.searchParams.get('endDate'), url.searchParams.get('category') || 'all'))
    return
  }

  // The weekly atlas: the map page, the calendar's region and "around" filters, panels.
  // A request with a session gets the free map; without one, the signed-out projection.
  // E2E_STUB_SIGNED_IN=1 answers every request as free, to look at the signed-in map without Clerk;
  // E2E_STUB_TIER=pro answers every request as a Pro reader (synthetic history, themes, tools).
  const tier = process.env.E2E_STUB_TIER === 'pro'
    ? 'pro'
    : Boolean(request.headers.authorization) || process.env.E2E_STUB_SIGNED_IN === '1' ? 'free' : 'signedOut'
  const signedIn = tier !== 'signedOut'
  const refuse = (detail) => send(response, 403, { detail })
  // Pro routes refuse alike: sign in first, then Pro.
  const proOnly = () => {
    if (tier === 'pro') return true
    refuse(signedIn ? 'pro_required' : 'sign_in_required')
    return false
  }
  if (path.startsWith('/v1/atlas')) {
    handleAtlas(request, response, url, path, { tier, signedIn, refuse, proOnly })
    return
  }

  // Homepage reads all three rankings server-side. A successful empty fixture
  // keeps the smoke test focused on layout and unexpected console errors;
  // Picks data and entitlement behavior are tested separately.
  if (path === '/v1/screener/rankings' && ['longTerm', 'income', 'shortTerm'].includes(url.searchParams.get('reading'))) {
    send(response, 200, {
      asOf: null,
      reading: url.searchParams.get('reading'),
      filters: { minCoverage: 0, eligibility: null, includeNonCompanies: false, nonCompanyRule: null },
      items: [],
    })
    return
  }

  // A company's standing in each ranking; free on the ticker page.
  const readingsMatch = path.match(/^\/v1\/tickers\/([^/]+)\/readings$/)
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

  // Synthetic ticker pages (QAS, QAM, QAL) for hero layout checks. Real symbols
  // stay unavailable, as before.
  const eventsRoute = path.match(/^\/v1\/tickers\/([^/]+)\/events$/)
  if (eventsRoute && isFixtureTicker(decodeURIComponent(eventsRoute[1]))) {
    send(response, 200, tickerEventsFixture(decodeURIComponent(eventsRoute[1])))
    return
  }

  const statementsRoute = path.match(/^\/v1\/tickers\/([^/]+)\/financial-statements$/)
  if (statementsRoute && isFixtureTicker(decodeURIComponent(statementsRoute[1]))) {
    send(response, 200, tickerFinancialStatementsFixture(decodeURIComponent(statementsRoute[1]), url.searchParams.get('statementType')))
    return
  }

  const metricsRoute = path.match(/^\/v1\/tickers\/([^/]+)\/market-metrics$/)
  if (metricsRoute && isFixtureTicker(decodeURIComponent(metricsRoute[1]))) {
    send(response, 200, tickerMarketMetricsFixture(decodeURIComponent(metricsRoute[1]), url.searchParams.get('metric')))
    return
  }

  const capitalRoute = path.match(/^\/v1\/tickers\/([^/]+)\/equity-capital-events$/)
  if (capitalRoute && isFixtureTicker(decodeURIComponent(capitalRoute[1]))) {
    send(response, 200, tickerEquityCapitalEventsFixture(decodeURIComponent(capitalRoute[1])))
    return
  }

  const disclosuresRoute = path.match(/^\/v1\/tickers\/([^/]+)\/disclosures$/)
  if (disclosuresRoute && isFixtureTicker(decodeURIComponent(disclosuresRoute[1]))) {
    send(response, 200, tickerDisclosuresFixture(decodeURIComponent(disclosuresRoute[1])))
    return
  }

  const actionsRoute = path.match(/^\/v1\/tickers\/([^/]+)\/corporate-actions$/)
  if (actionsRoute && isFixtureTicker(decodeURIComponent(actionsRoute[1]))) {
    send(response, 200, tickerCorporateActionsFixture(decodeURIComponent(actionsRoute[1])))
    return
  }

  const tickerRoute = path.match(/^\/v1\/tickers\/([^/]+)\/(summary|ohlc|history)$/)
  if (tickerRoute && isFixtureTicker(decodeURIComponent(tickerRoute[1]))) {
    const ticker = decodeURIComponent(tickerRoute[1])
    const periodDays = url.searchParams.get('period_days')
    if (tickerRoute[2] === 'summary') send(response, 200, tickerSummaryFixture(ticker))
    else if (tickerRoute[2] === 'ohlc') send(response, 200, tickerOhlcFixture(ticker, periodDays))
    else send(response, 200, tickerHistoryFixture(ticker, periodDays))
    return
  }

  // Anything this fixture does not model stays unavailable on purpose.
  send(response, 503, { error: 'fixture_backend_unavailable', path })
})

function handleAtlas(request, response, url, path, { tier, signedIn, refuse, proOnly }) {
  const asOf = url.searchParams.get('asOf')
  const lens = url.searchParams.get('lens')
  if (path === '/v1/atlas') {
    const level = Number.parseInt(url.searchParams.get('level') ?? '0', 10)
    const bbox = url.searchParams.get('bbox')
    if (!signedIn && (level > 1 || bbox || asOf || lens === 'total')) return refuse('sign_in_required')
    const box = bbox ? bbox.split(',').map(Number) : null
    if (tier === 'pro') {
      const body = proOverviewFixture({ level, bbox: box, asOf, lens })
      return body ? send(response, 200, body) : send(response, 404, { detail: `No weekly atlas for ${asOf}` })
    }
    if (asOf || lens === 'total') return refuse('pro_required')
    return send(response, 200, atlasOverviewFixture({ signedIn, level, bbox: box }))
  }
  if (path === '/v1/atlas/weeks') return proOnly() && send(response, 200, weeksFixture())
  if (path === '/v1/atlas/movement') {
    if (!proOnly()) return
    const body = movementFixture(url.searchParams.get('from'), url.searchParams.get('to'))
    return body ? send(response, 200, body) : send(response, 404, { detail: 'No such weeks' })
  }
  if (path === '/v1/atlas/themes') {
    if (!signedIn) return refuse('sign_in_required')
    return send(response, 200, themesFixture(tier))
  }
  const theme = path.match(/^\/v1\/atlas\/themes\/([^/]+)$/)
  if (theme) {
    if (!signedIn) return refuse('sign_in_required')
    const body = themeFixture(decodeURIComponent(theme[1]), tier)
    return body ? send(response, 200, body) : send(response, 404, { detail: 'No such theme' })
  }
  if (path === '/v1/atlas/influence') return proOnly() && send(response, 200, influenceFixture())
  if (path === '/v1/atlas/compare') {
    if (!proOnly()) return
    const body = compareFixture(url.searchParams.get('a'), url.searchParams.get('b'))
    return body ? send(response, 200, body) : send(response, 422, { detail: 'Pick two different sets.' })
  }
  if (path === '/v1/atlas/test') {
    if (!proOnly()) return
    const answer = testFixture({ from: url.searchParams.get('from'), to: url.searchParams.get('to'), testsRun: Number(url.searchParams.get('testsRun')) })
    return answer ? send(response, 200, answer) : send(response, 422, { detail: 'Pick two different sets.' })
  }
  const atlasCompany = path.match(/^\/v1\/atlas\/companies\/([^/]+)$/)
  if (atlasCompany) {
    const symbol = decodeURIComponent(atlasCompany[1]).toUpperCase()
    if (tier !== 'pro' && lens === 'total') return refuse(signedIn ? 'pro_required' : 'sign_in_required')
    const { status, body } = tier === 'pro' ? proCompanyFixture(symbol, lens) : atlasCompanyFixture(symbol, signedIn)
    return send(response, status, body)
  }
  const atlasZone = path.match(/^\/v1\/atlas\/zones\/([^/]+)$/)
  if (atlasZone) {
    if (tier !== 'pro' && lens === 'total') return refuse(signedIn ? 'pro_required' : 'sign_in_required')
    const { status, body } = atlasZoneFixture(decodeURIComponent(atlasZone[1]), signedIn)
    return send(response, status, body)
  }
  send(response, 503, { error: 'fixture_backend_unavailable', path })
}

server.listen(PORT, HOST, () => {
  console.log(`[e2e-backend-stub] fixture backend listening on http://${HOST}:${PORT}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
