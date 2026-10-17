import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

test('ENG-230: cron, entrega, CSV e proxy sintético foram apagados', () => {
  for (const path of ['app/api/cron/check-signals/route.ts', 'app/api/export-signals/route.ts',
    'lib/alert-service.ts', 'lib/alerts.ts', 'components/stocks/TickerExportButton.tsx',
    'app/api/research/synthetic/[...parts]/route.ts', 'lib/synthetic-research-proxy.ts']) {
    assert.equal(existsSync(path), false, path)
  }
  const deployment=JSON.parse(readFileSync('vercel.json','utf8'))
  assert.equal((deployment.crons || []).some(job => job.path === '/api/cron/check-signals'), false)
  assert.equal(readFileSync('lib/platform-client.ts','utf8').includes('signals/export'), false)
  assert.match(readFileSync('components/stocks/StockTickerChrome.tsx','utf8'), /Watchlist/)
})
