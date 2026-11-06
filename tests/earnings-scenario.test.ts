import assert from 'node:assert/strict'
import test from 'node:test'
import {scenarioInputs} from '../lib/earnings-scenario'
const now=Date.parse('2026-11-04T12:00:00Z')
const input={version:'earnings_model_inputs.v1',symbol:'QAS',source:'yahoo_finance',currency:'USD',eps:2,epsBasis:'provider_trailing_eps',observedAt:'2026-11-04T11:00:00Z',price:40,priceDate:'2026-11-04',priceBasis:'raw'}
test('model inputs require current native attested source metadata',()=>{
 assert.ok(scenarioInputs(input,'QAS',now))
 for(const patch of [{currency:'GBX'},{eps:-1},{eps:true},{observedAt:'2026-10-01T11:00:00Z'},{priceDate:'2026-11-03'},{source:'other'},{priceBasis:'adjusted'}])assert.equal(scenarioInputs({...input,...patch},'QAS',now),null)
 assert.equal(scenarioInputs(input,'OTHER',now),null)
})
