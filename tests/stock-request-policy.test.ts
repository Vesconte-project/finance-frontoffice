import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { chartEventsResponse } from '../lib/chart-events'

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(`${dir}/${item.name}`) : item.name.endsWith('.tsx') ? [`${dir}/${item.name}`] : [])
}

test('ticker links never speculatively prefetch an SSR page', () => {
  let count = 0
  for (const file of [...files('app'), ...files('components')]) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(node: ts.Node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'Link' &&
          node.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === 'href' && prop.getText(source).includes('/stocks/'))) {
        const prefetch = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === 'prefetch')
        assert.equal(prefetch?.getText(source), 'prefetch={false}', file); count++
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  assert.ok(count >= 20)
  assert.doesNotMatch(readFileSync('components/marketing/HeroConstellation.tsx', 'utf8'), /routerRef\.current\.prefetch/)
})

test('chart data is absent from SSR and requested only by the expanded component', () => {
  const page = readFileSync('app/(app)/stocks/[ticker]/page.tsx', 'utf8')
  assert.doesNotMatch(page, /getTickerEvents|getTickerDisclosures|chartEventsPromise/)
  const overview = readFileSync('components/stocks/StockOverviewClient.tsx', 'utf8')
  assert.match(overview, /chartExpanded \? \(/)
  assert.match(readFileSync('components/stocks/ExpandedChartDialog.tsx', 'utf8'), /\/chart-events/)
  for (const tab of ['events', 'relationships', 'financials']) {
    assert.doesNotMatch(readFileSync(`app/(app)/stocks/[ticker]/${tab}/page.tsx`, 'utf8'), /getStockResearchData/)
  }
})

test('optional disclosure failure leaves events usable; primary limits preserve HTTP metadata without retry', async () => {
  const saved = { ...process.env }; const fetcher = globalThis.fetch
  for (const name of ['CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'VERCEL', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']) delete process.env[name]
  process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  try {
    for (const status of [200, 429, 503]) {
      const calls: string[] = []
      globalThis.fetch = async url => {
        calls.push(String(url))
        return String(url).includes('/disclosures') ? new Response('{}', { status: 503 }) :
          Response.json({ available: true, rows: [] }, { status, headers: { 'Retry-After': '17' } })
      }
      const response = await chartEventsResponse('QAS')
      assert.equal(response.status, status)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert.equal(response.headers.get('retry-after'), status === 200 ? null : '17')
      assert.equal(calls.filter(path => path.includes('/events?')).length, 1)
      assert.equal(calls.filter(path => path.includes('/disclosures?')).length, 1)
      if (status === 200) assert.deepEqual(await response.json(), [])
    }
  } finally {
    globalThis.fetch = fetcher
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name]
    for (const [name, value] of Object.entries(saved)) process.env[name] = value
  }
})
