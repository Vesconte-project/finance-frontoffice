import assert from 'node:assert/strict'
import { createHmac, randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { accessHeaders, signVisitorIP } from '../lib/backend-origin-proof'

test('visitor proof binds IP, timestamp, method, path and request id', () => {
  const key = randomBytes(48).toString('hex')
  const env = { VERCEL: '1', BFF_IP_PROOF_KEY: key }
  const proof = signVisitorIP('203.0.113.8', 'GET', '/v1/tickers/ACME/ohlc', env)
  const payload = JSON.stringify(['vesconte.ip.v1', proof['X-Vesconte-Client-IP'], proof['X-Vesconte-IP-Timestamp'],
    'GET', '/v1/tickers/ACME/ohlc', proof['X-Vesconte-IP-Request-ID']])
  assert.equal(proof['X-Vesconte-IP-Signature'], createHmac('sha256', key).update(payload).digest('hex'))
  assert.ok(Math.abs(Date.now()/1000 - Number(proof['X-Vesconte-IP-Timestamp'])) < 2)
  assert.notEqual(proof['X-Vesconte-IP-Request-ID'], signVisitorIP('203.0.113.8', 'GET', '/v1/me', env)['X-Vesconte-IP-Request-ID'])
  assert.equal('Authorization' in proof, false)
  assert.equal('CF-Access-Client-Secret' in proof, false)
})

test('missing key, non-Vercel runtime or malformed IP sends no visitor proof', () => {
  const key = randomBytes(48).toString('hex')
  for (const env of [{}, { VERCEL:'1' }, { BFF_IP_PROOF_KEY:key }])
    assert.deepEqual(signVisitorIP('203.0.113.8', 'GET', '/v1/me', env), {})
  assert.deepEqual(signVisitorIP('203.0.113.8, 203.0.113.9', 'GET', '/v1/me', { VERCEL:'1', BFF_IP_PROOF_KEY:key }), {})
  assert.deepEqual(signVisitorIP(null, 'GET', '/v1/me', { VERCEL:'1', BFF_IP_PROOF_KEY:key }), {})
})

test('Access pair is independent of the visitor proof and never emitted partially', () => {
  const id=randomBytes(16).toString('hex'), secret=randomBytes(32).toString('hex')
  assert.deepEqual(accessHeaders({}), {})
  assert.throws(() => accessHeaders({ CF_ACCESS_CLIENT_ID:id }))
  assert.throws(() => accessHeaders({ CF_ACCESS_CLIENT_SECRET:secret }))
  assert.deepEqual(accessHeaders({ CF_ACCESS_CLIENT_ID:id, CF_ACCESS_CLIENT_SECRET:secret }),
    { 'CF-Access-Client-Id':id, 'CF-Access-Client-Secret':secret })
})


test('Vercel IPv6 is canonical before signing and matches the backend address contract',()=>{
  const env={VERCEL:'1',BFF_IP_PROOF_KEY:randomBytes(48).toString('hex')}
  for(const ip of ['2001:0DB8:0000:0000:0000:0000:0000:0001','2001:db8::1'])
    assert.equal(signVisitorIP(ip,'GET','/v1/me',env)['X-Vesconte-Client-IP'],'2001:db8::1')
})
