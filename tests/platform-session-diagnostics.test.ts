import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlatformClient, PlatformError } from '../lib/platform-client'
import { reportPlatformSessionFailure } from '../lib/platform-session-diagnostics'

function capture() {
  const original = console.error
  const lines: string[] = []
  console.error = (line: string) => lines.push(line)
  return { lines, restore: () => { console.error = original } }
}

test('a failed real platform-client request records only phase, status and a fixed category', async () => {
  const logs = capture()
  const client = createPlatformClient({ baseUrl: 'https://backend.example.test',
    getToken: async () => 'private-session-token',
    fetcher: async () => new Response('private-account-details', { status: 500 }) })
  try {
    let failure: unknown
    try { await client('/me') } catch (error) { failure = error }
    assert.ok(failure instanceof PlatformError)
    reportPlatformSessionFailure('account_request', failure)
    assert.equal(logs.lines.length, 1)
    const line = JSON.parse(logs.lines[0])
    assert.equal(line.event, 'platform_session_failed')
    assert.equal(line.phase, 'account_request')
    assert.equal(line.status, 500)
    assert.equal(line.failure, 'platform_error')
    assert.equal(logs.lines[0].includes('private-'), false)
    assert.equal(logs.lines[0].includes('backend.example.test'), false)
  } finally { logs.restore() }
})

test('network failure remains 502 and does not expose the underlying exception', async () => {
  const logs = capture()
  const client = createPlatformClient({ baseUrl: 'https://backend.example.test', getToken: async () => 'private-token',
    fetcher: async () => { throw new Error('private-url-password') } })
  try {
    await assert.rejects(client('/me'), (error: unknown) => {
      reportPlatformSessionFailure('account_request', error)
      return error instanceof PlatformError && error.status === 502
    })
    assert.equal(JSON.parse(logs.lines[0]).status, 502)
    assert.equal(logs.lines[0].includes('private-'), false)
  } finally { logs.restore() }
})

test('malformed account JSON is distinct from an HTTP failure without logging the body', async () => {
  const logs = capture()
  try {
    const response = new Response('private-invalid-account-json')
    await assert.rejects(response.json(), (error: unknown) => {
      reportPlatformSessionFailure('account_response', error)
      return error instanceof SyntaxError
    })
    const line = JSON.parse(logs.lines[0])
    assert.equal(line.phase, 'account_response')
    assert.equal(line.status, null)
    assert.equal(line.failure, 'invalid_json')
    assert.equal(logs.lines[0].includes('private-'), false)
  } finally { logs.restore() }
})

test('expected auth refusals stay quiet and unknown exceptions never log their fields', () => {
  const logs = capture()
  try {
    for (const status of [401, 403, 404]) reportPlatformSessionFailure('account_selection', new PlatformError(status))
    assert.equal(logs.lines.length, 0)
    const error = Object.assign(new Error('private-message'), { token: 'private-token', account: 'private-account' })
    reportPlatformSessionFailure('identity', error)
    assert.equal(JSON.parse(logs.lines[0]).failure, 'unexpected_error')
    assert.equal(logs.lines[0].includes('private-'), false)
  } finally { logs.restore() }
})

test('logging failure cannot replace the original product failure', () => {
  const original = console.error
  console.error = () => { throw new Error('logging unavailable') }
  try {
    assert.doesNotThrow(() => reportPlatformSessionFailure('account_validation', new PlatformError(502)))
  } finally { console.error = original }
})
