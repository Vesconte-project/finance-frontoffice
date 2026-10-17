import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Execute the actual handler and reservation helper with isolated provider
// boundaries. No Clerk, backend, email service or real credentials are used.
function load(file, imports, env) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  runInNewContext(code, {
    exports, process: { env },
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`)
      return imports[name]
    },
  }, { filename: file })
  return exports
}

function setup(env, reservation = { events: [] }) {
  const calls = { backend: 0, sends: 0, records: 0 }
  const events = [{ ticker: 'SYNTH', signalDate: '2026-10-17', fromDirection: 'neutral', toDirection: 'bullish', conviction: 0.8 }]
  const alerts = load('lib/alerts.ts', {
    '@clerk/nextjs/server': { clerkClient: async () => ({ users: { getUser: async () => ({
      emailAddresses: [{ emailAddress: 'synthetic@example.invalid' }], firstName: 'Synthetic',
    }) } }) },
    '@/lib/site-url': { siteBaseUrl: () => 'https://example.invalid' },
    '@/lib/backend': { fetchBackendJson: async path => {
      calls.backend++
      if (path.endsWith('/record')) { calls.records++; return { ok: true } }
      if (reservation instanceof Error) throw reservation
      return reservation === 'confirmed' ? { events } : reservation
    } },
  }, env)
  const handler = load('app/api/cron/check-signals/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/signals': { getSignalFlipsOnDate: async () => events },
    '@/lib/watchlist': {
      getAllWatchlistTickers: async () => { calls.backend++; return ['SYNTH'] },
      getWatchlistSubscriptionsForTickers: async () => [{ userId: 'synthetic-user', ticker: 'SYNTH' }],
    },
    '@/lib/alerts': { ...alerts, sendSignalFlipAlertEmail: async () => { calls.sends++; return { ok: true } } },
  }, env)
  return { calls, get: token => handler.GET({
    headers: new Headers(token ? { authorization: `Bearer ${token}` } : {}),
    nextUrl: new URL('https://example.invalid/api/cron/check-signals?date=2026-10-17'),
  }) }
}

test('missing cron credential denies before reading subscriptions, even with market-refresh credential', async () => {
  const fallback = randomUUID()
  for (const value of [undefined, '', '   ']) {
    const app = setup({ SIGNAL_ALERT_CRON_TOKEN: value, MARKET_REFRESH_TOKEN: fallback })
    assert.equal((await app.get(fallback)).status, 401)
    assert.deepEqual(app.calls, { backend: 0, sends: 0, records: 0 })
  }
})

test('missing or incorrect bearer is refused when the cron credential exists', async () => {
  const app = setup({ SIGNAL_ALERT_CRON_TOKEN: randomUUID() })
  assert.equal((await app.get()).status, 401)
  assert.equal((await app.get(randomUUID())).status, 401)
  assert.equal(app.calls.backend, 0)
})

for (const [name, reservation] of [
  ['backend failure', new Error('Synthetic backend failure')],
  ['empty response', null], ['missing reservation', {}],
  ['malformed reservation', { events: 'invalid' }], ['no reserved events', { events: [] }],
]) {
  test(`${name} never sends or records an email`, async () => {
    const token = randomUUID()
    const app = setup({ SIGNAL_ALERT_CRON_TOKEN: token }, reservation)
    assert.equal((await app.get(token)).status, 200)
    assert.equal(app.calls.sends, 0)
    assert.equal(app.calls.records, 0)
  })
}

test('valid cron bearer and confirmed reservation allow one send and one record', async () => {
  const token = randomUUID()
  const app = setup({ SIGNAL_ALERT_CRON_TOKEN: token }, 'confirmed')
  assert.equal((await app.get(token)).status, 200)
  assert.equal(app.calls.sends, 1)
  assert.equal(app.calls.records, 1)
})
