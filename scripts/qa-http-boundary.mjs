import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import ts from 'typescript'
import { createServer } from 'node:http'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'

// Own fixed ports inside an isolated --network=none container. No external APIs.
const fixture = fileURLToPath(new URL('../tests/fixtures/http-boundary/', import.meta.url))
const next = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url))
// Compile the actual production signing implementation; no copied crypto logic.
const proofSource = await readFile(new URL('../lib/backend-origin-proof.ts', import.meta.url), 'utf8')
await writeFile(`${fixture}lib/proof.generated.js`, ts.transpileModule(proofSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
const key = randomBytes(48).toString('hex')
const identity = `Bearer ${randomBytes(32).toString('hex')}`
const counts = new Map()
const observations = []
const backend = createServer(async (req, res) => {
  const id = req.headers['x-fixture-case']
  const row = counts.get(id) || { required: 0, optional: 0 }
  counts.set(id, row)
  if (req.url === '/health') { res.end('ok'); return }
  if (req.url === '/optional') { row.optional++; res.writeHead(503); res.end('{}'); return }
  row.required++
  const url = new URL(req.url, 'http://fixture')
  const h = req.headers
  const message = JSON.stringify(['vesconte.ip.v1', h['x-vesconte-client-ip'], h['x-vesconte-ip-timestamp'], 'GET', url.pathname, h['x-vesconte-ip-request-id']])
  const expected = createHmac('sha256', key).update(message, 'ascii').digest('hex')
  const signature = h['x-vesconte-ip-signature'] || ''
  const valid = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) &&
    h['x-vesconte-client-ip'] === '203.0.113.8' && Math.abs(Date.now()/1000 - Number(h['x-vesconte-ip-timestamp'])) <= 60 &&
    (!h.authorization || h.authorization === identity)
  row.validIdentityAndProof = valid
  await pause(60) // make streaming behavior observable
  res.writeHead(valid ? Number(url.searchParams.get('status')) : 403,
    { 'Content-Type': 'application/json', ...(String(id).includes('missing-retry') ? {} : { 'Retry-After': String(id).includes('date-retry') ? 'Tue, 27 Oct 2026 00:00:00 GMT' : '17' }) })
  res.end(JSON.stringify({ name: 'Fixture Company' }))
})
await new Promise(resolve => backend.listen(3101, '127.0.0.1', resolve))
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', BFF_IP_PROOF_KEY: key, FIXTURE_BACKEND: 'http://127.0.0.1:3101' }
let app
async function stop(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await once(child, 'exit')
}
try {
  const build = spawn(process.execPath, [next, 'build', '--webpack', fixture], { env, stdio: 'inherit' })
  const [code] = await once(build, 'exit'); assert.equal(code, 0, 'fixture production build')
  app = spawn(process.execPath, [next, 'start', fixture, '--port', '3100'], { env, stdio: 'inherit' })
  let ready = false
  for (let i = 0; i < 100; i++) {
    try { await fetch('http://localhost:3100/api/required/200'); ready = true; break } catch { await pause(100) }
  }
  assert.equal(ready, true, 'Next server became ready')
  for (const mode of ['stream', 'buffered', 'ssr', 'api/required']) for (const status of [200, 429, 503]) {
    const id = `${mode}:${status}`
    const response = await fetch(`http://localhost:3100/${mode}/${status}`, { headers: {
      authorization: identity, 'x-vercel-forwarded-for': '203.0.113.8',
      'x-forwarded-for': '198.51.100.99', 'x-fixture-case': id, 'user-agent': 'Mozilla/5.0',
    } })
    const html = await response.text()
    const row = counts.get(id)
    if (mode !== 'buffered' || status === 200) assert.equal(row.required, 1, `${id}: one mandatory load across header/metadata/page`)
    else assert.equal(row.required, 2, `${id}: failed rendering repeats the mandatory load`)
    assert.equal(row.validIdentityAndProof, true, `${id}: original identity and real signing helper`)
    const expected = status === 200 ? 200 : mode === 'stream' ? 200 : mode === 'buffered' ? 500 : status
    assert.equal(response.status, expected, id)
    assert.equal(response.headers.get('retry-after'), ['ssr', 'api/required'].includes(mode) && status !== 200 ? '17' : null, id)
    if (mode === 'ssr') {
      assert.equal(row.optional, status === 200 ? 1 : 0)
      if (status === 200) assert.match(html, /Optional unavailable/)
      assert.match(response.headers.get('cache-control'), /no-store/)
    }
    observations.push({ mode, upstreamStatus: status, responseStatus: response.status, retryAfter: response.headers.get('retry-after'), ...row })
  }
  for (const [id, authorization, retryAfter] of [
    ['anonymous', '', '17'],
    ['missing-retry', identity, '60'],
    ['date-retry', identity, 'Tue, 27 Oct 2026 00:00:00 GMT'],
  ]) {
    const response = await fetch('http://localhost:3100/ssr/429', { headers: {
      authorization, 'x-vercel-forwarded-for': '203.0.113.8', 'x-fixture-case': id,
    } })
    await response.text()
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('retry-after'), retryAfter)
    assert.equal(counts.get(id).required, 1)
    assert.equal(counts.get(id).validIdentityAndProof, true)
    observations.push({ mode: id, responseStatus: response.status, retryAfter, ...counts.get(id) })
  }
  const refused = await fetch('http://localhost:3100/api/required/200', { headers: {
    authorization: 'Bearer forged-fixture-identity', 'x-vercel-forwarded-for': '203.0.113.8', 'x-fixture-case': 'forged',
  } })
  assert.equal(refused.status, 403)
  assert.equal(counts.get('forged').required, 1)
  assert.equal(counts.get('forged').validIdentityAndProof, false)
  observations.push({ mode: 'forged-identity', responseStatus: refused.status, ...counts.get('forged') })
  console.log(JSON.stringify({ nextVersion: '16.2.12', checks: observations.length, observations }, null, 2))
} finally {
  await stop(app)
  backend.closeAllConnections()
  await new Promise(resolve => backend.close(resolve))
}
