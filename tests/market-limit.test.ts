import assert from 'node:assert/strict'
import test from 'node:test'

import { marketLimitNotice, marketLimitWait } from '../lib/market-limit'

test('a 429 is a reached limit with its wait; anything else is not', () => {
  assert.deepEqual(marketLimitNotice({ status: 429, retryAfter: '3600' }), { minutes: 60 })
  assert.deepEqual(marketLimitNotice({ status: 429, retryAfter: '61' }), { minutes: 2 })
  assert.deepEqual(marketLimitNotice({ status: 429, retryAfter: null }), { minutes: null })
  for (const other of [{ status: 503 }, { status: 404 }, new Error('x'), null, undefined])
    assert.equal(marketLimitNotice(other), null)
})

test('the wait is said in words a reader understands', () => {
  assert.equal(marketLimitWait({ minutes: 1 }), 'in about 1 minute')
  assert.equal(marketLimitWait({ minutes: 25 }), 'in about 25 minutes')
  assert.equal(marketLimitWait({ minutes: 60 }), 'in about 1 hour')
  assert.equal(marketLimitWait({ minutes: 1440 }), 'in about 24 hours')
  assert.equal(marketLimitWait({ minutes: null }), 'in a while')
})
