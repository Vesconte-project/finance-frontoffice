import assert from 'node:assert/strict'
import test from 'node:test'
import {collectHistoryPages,collectPricePages} from '../lib/full-history'

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
