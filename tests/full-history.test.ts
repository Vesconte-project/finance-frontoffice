import assert from 'node:assert/strict'
import test from 'node:test'
import {collectHistoryPages,collectPricePages,orderedPriceRows} from '../lib/full-history'
import { convertedClosesFromHistory, convertedOhlcFromRows, currencyDecomposition, localizeRows } from '../lib/display-currency'
import { normalizeAdjustedHistory } from '../lib/price-basis'
import { normalizeOhlcPayload } from '../lib/ohlc-data'
import { isFullHistoryLoaded, rangeStartIndex, summarizeVisible } from '../lib/expanded-chart'

test('three backward weekly pages become one ascending history for every chart path', async () => {
 const rows = Array.from({length:1800}, (_, i) => {
  const date = new Date(Date.UTC(1992,0,3) + i * 7 * 86400000).toISOString().slice(0,10)
  const close = 10 + i
  const money = Object.fromEntries(['open','high','low','close'].map(field => [field, {
   price_basis:'adjusted', value:close, currency:'USD', sourceCurrency:'USD', date,
   converted:{value:close * 2, currency:'EUR', rate:2, rateDate:date},
  }]))
  return {date, price_basis:'adjusted' as const, open:close, high:close, low:close, close, volume:100, money}
 })
 const pages = [rows.slice(1200),rows.slice(600,1200),rows.slice(0,600)]
 const seen: (string|null)[] = []
 const combined = await collectPricePages(async end => {
  const page = seen.length
  seen.push(end)
  const nextEnd = page === 2 ? null : new Date(Date.parse(`${pages[page][0].date}T00:00:00Z`) - 86400000).toISOString().slice(0,10)
  return {rows:pages[page],nextEnd}
 })
 assert.equal(seen.length,3)
 assert.deepEqual(combined,rows)
 const reported = normalizeAdjustedHistory(combined)
 const bars = normalizeOhlcPayload(combined,{coverageExpectsPrices:true}).rows
 const converted = convertedClosesFromHistory(combined,'EUR')
 const convertedBars = convertedOhlcFromRows(combined,'EUR')
 for (const series of [reported,bars,converted,convertedBars]) {
  assert.equal(series.length,1800)
  assert.equal(new Set(series.map(row=>row.date)).size,1800)
  assert.equal(series[0].date,rows[0].date)
  assert.equal(series.at(-1)?.date,rows.at(-1)?.date)
  assert.ok(series.every((row,i)=>i===0 || row.date>series[i-1].date))
 }
 assert.equal(convertedBars.at(-1)?.close,rows.at(-1)!.close*2)
 const facts = summarizeVisible(bars,{from:0,to:bars.length-1})!
 assert.equal(facts.firstClose,rows[0].close)
 assert.equal(facts.lastClose,rows.at(-1)?.close)
 assert.equal(currencyDecomposition(converted).result?.to,rows.at(-1)?.date)
 assert.ok(rangeStartIndex(bars,'1Y')>1700)
 assert.equal(isFullHistoryLoaded(bars),true)
 assert.equal(isFullHistoryLoaded(bars,13000),true)
 assert.equal(isFullHistoryLoaded(bars,3650),false)
})

test('identical duplicate dates are coalesced across and within pages regardless of key order',async()=>{
 const row={date:'2026-11-06',close:10,money:{close:{currency:'USD',value:10}}}
 const reordered={money:{close:{value:10,currency:'USD'}},close:10,date:'2026-11-06'}
 let call=0
 const out=await collectPricePages(async()=>++call===1
  ? {rows:[row,row],nextEnd:'2026-11-05'}
  : {rows:[{date:'2026-11-05',close:9},reordered],nextEnd:null})
 assert.deepEqual(out.map(row=>(row as {date:string}).date),['2026-11-05','2026-11-06'])
})

test('conflicting duplicate prices, OHLC fields and currency metadata fail before normalization',async()=>{
 const row={date:'2026-11-06',close:10.00001,open:9,money:{close:{value:10,currency:'USD',converted:{value:8,currency:'EUR'}}}}
 for(const changed of [
  {...row,close:10.00002}, {...row,open:8},
  {...row,money:{close:{...row.money.close,converted:{value:7,currency:'EUR'}}}},
 ]) {
  for(const pair of [[row,changed],[changed,row]]) {
   let call=0
   await assert.rejects(collectPricePages(async()=>({rows:[pair[call]],nextEnd:call++===0?'2026-11-05':null})),/price_history_conflicting_date/)
  }
 }
})

test('ordering validates calendar dates and handles empty or single-page histories',()=>{
 assert.deepEqual(orderedPriceRows([]),[])
 assert.deepEqual(orderedPriceRows([{date:'2026-11-06'},{date:'2003-01-02'}]).map(row=>row.date),['2003-01-02','2026-11-06'])
 for(const date of ['2026-02-30','invalid','2026-11-06T00:00:00Z']) assert.throws(()=>orderedPriceRows([{date}]),/price_history_date_invalid/)
})

test('full history traverses server pages without treating a tier cap as completion',async()=>{
 const pages=[{available:true,rows:[{year:1990}],count:1},{available:true,rows:[{year:2026}],count:1},{available:true,rows:[],count:0}]
 const seen:number[]=[]
 const out=await collectHistoryPages(async page=>{seen.push(page);return pages[page]})
 assert.deepEqual(seen,[0,1,2]);assert.equal(out.rows.length,2)
})
test('partial failures and repeated pages never become a complete history',async()=>{
 await assert.rejects(collectHistoryPages(async()=>({available:true,rows:[1],count:1})),/did_not_advance/)
 await assert.rejects(collectHistoryPages(async p=>({available:p===0,rows:p===0?[1]:[],count:1})),/unavailable/)
})
test('explicit final financial page avoids trusting the spurious next link',async()=>{
 let calls=0;await collectHistoryPages(async()=>{calls++;return{available:true,rows:[1],count:1,truncated:false}});assert.equal(calls,1)
})
test('price history follows descending date windows across more than thirty years',async()=>{
 const seen:(string|null)[]=[]
 const rows=await collectPricePages(async end=>{seen.push(end);return end===null?{rows:[{date:'2026-01-01'}],nextEnd:'2000-01-01'}:{rows:[{date:'1990-01-01'}],nextEnd:null}})
 assert.equal(rows.length,2);assert.deepEqual(seen,[null,'2000-01-01'])
 await assert.rejects(collectPricePages(async()=>({rows:[1],nextEnd:'2000-01-01'})),/did_not_advance/)
})

test('overlapping pages are refused instead of silently mixing a changing publication',async()=>{
 await assert.rejects(collectHistoryPages(async p=>({available:true,rows:p===0?[1,2]:[2,3],count:2})),/overlap/)
 const out=await collectHistoryPages(async p=>({available:true,rows:p===0?[1]:[2],count:1,truncated:p===0}))
 assert.equal(out.truncated,false);assert.deepEqual(out.rows,[1,2])
})


test('a missing conversion on a later history page keeps the whole series as reported', async () => {
 const row = (year: number, converted: number | null) => ({
  year, lineItemId: 'revenue', value: 1000, currency: 'KRW',
  money: {value: {value: 1000, currency: 'KRW', sourceCurrency: 'KRW', date: `${year}-12-31`,
   converted: converted === null ? null : {value: converted, currency: 'USD', rate: .001, rateDate: `${year}-12-31`},
   unconvertedReason: converted === null ? 'no_rate' : null}},
 })
 const payload = await collectHistoryPages(async page => ({
  available: true, count: 1, rows: [row(2025 - page, page === 0 ? 1 : null)], truncated: page === 0,
 }))
 const localized = localizeRows(payload.rows, 'USD')
 assert.equal(localized.converted, false)
 assert.deepEqual(localized.rows.map(r => [r.value, r.currency]), [[1000, 'KRW'], [1000, 'KRW']])
})
