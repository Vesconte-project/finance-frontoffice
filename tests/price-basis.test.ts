import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { normalizeAdjustedHistory, readyAdjustedOverlays, type TechnicalChartPayload } from '../lib/price-basis'
const bars = [{date:'2026-01-05',close:100,price_basis:'adjusted' as const}]
const ready: TechnicalChartPayload = {price_basis:'adjusted',availability_status:'ready',unavailable_reason:null,series:[{key:'sma_20',unit:'price',price_basis:'adjusted',points:[{date:'2026-01-05',value:100}]}]}
test('history keeps its adjusted basis without substituting raw/unknown rows', () => {
  assert.deepEqual(normalizeAdjustedHistory(bars), bars)
  for (const row of [{date:'2026-01-05',close:200},{...bars[0],price_basis:'raw'},{...bars[0],close:NaN}]) {
    assert.throws(() => normalizeAdjustedHistory([row]), /adjusted_price_input_invalid/)
  }
})
test('only ready overlays on the identical adjusted basis can be drawn', () => {
  assert.equal(1,readyAdjustedOverlays(ready,bars).length)
  assert.deepEqual(readyAdjustedOverlays({...ready,availability_status:'stale',unavailable_reason:'adjusted_price_history_stale'},bars),[])
  assert.deepEqual(readyAdjustedOverlays(ready,[{price_basis:'raw'}]),[])
  assert.deepEqual(readyAdjustedOverlays(ready,[{}]),[])
  assert.deepEqual(readyAdjustedOverlays(null,bars),[])
})
test('the canvas checks readiness at draw time and quote change stays on the raw quote path', () => {
  const source=fs.readFileSync('components/stocks/ExpandedPriceCanvas.tsx','utf8')
  assert.match(source,/readyAdjustedOverlays\(propsRef.current.overlayPayload, data\)/)
  const finance=fs.readFileSync('lib/finance.ts','utf8')
  assert.match(finance,/changePercent: typeof quote.changePercent/)
  assert.match(finance,/price,\s*change: typeof quote.change/)
  assert.doesNotMatch(finance,/changePercent:.*historical/)
  const dialog=fs.readFileSync('components/stocks/ExpandedChartDialog.tsx','utf8')
  assert.match(dialog,/ADJUSTED_PRICE_LABEL/)
})

test('full history changes cache identity and refuses an old raw cache response', () => {
  const source=fs.readFileSync('components/stocks/StockOverviewClient.tsx','utf8')
  assert.match(source,/history\?price_basis=\$\{ADJUSTED_CHART_VERSION\}/)
  assert.match(source,/normalizeAdjustedHistory\(payload\)/)
  assert.throws(() => normalizeAdjustedHistory([{date:'2026-01-05',close:200}]))
})
