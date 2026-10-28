import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { connect } from 'node:net'
import { clerkQaConfigurationError } from './browser-qa-clerk.mjs'

const QA_HOST = '127.0.0.1'
const QA_PORT = 3100
// The fixture backend is part of the same owned server set, so a stale process
// on its port is reported the same way rather than surfacing as a webServer
// start failure.
const STUB_PORT = Number(process.env.E2E_BACKEND_STUB_PORT || 3101)

function fail(message, remediation) {
  console.error(`[qa:browser:infra] ${message}`)
  console.error(`[qa:browser:infra] ${remediation}`)
  process.exitCode = 1
}

let chromium

if (!process.env.PLAYWRIGHT_BASE_URL?.trim()) {
  try {
    const { default: { loadEnvConfig } } = await import('@next/env')
    // Match the environment Next will load, without printing loaded values.
    loadEnvConfig(process.cwd(), process.env.PLAYWRIGHT_SERVER_MODE?.trim() !== 'production',
      { info() {}, error() {} })
    const error = clerkQaConfigurationError(process.env)
    if (error) fail(error, 'Configure the existing QA Development keys in the process or local env file and retry. Do not create or claim a keyless instance.')
  } catch {
    fail('The Next.js environment could not be loaded for browser QA.', 'Run `npm ci` and retry `npm run qa:browser`.')
  }
}

try {
  chromium = (await import('@playwright/test')).chromium
} catch {
  fail('Playwright is not installed.', 'Run `npm ci` and retry `npm run qa:browser`.')
}

if (chromium) {
  try {
    await access(chromium.executablePath(), constants.X_OK)
  } catch {
    fail(
      'The project Chromium binary is missing or is not executable.',
      'Run `npx playwright install chromium` locally, or `npx playwright install --with-deps chromium` in CI.'
    )
  }
}

function inspectQaPort(port) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: QA_HOST, port })

    socket.setTimeout(1_000)
    socket.once('connect', () => {
      socket.destroy()
      resolve('occupied')
    })
    socket.once('error', (error) => {
      socket.destroy()
      if (error.code === 'ECONNREFUSED') {
        resolve('available')
        return
      }
      reject(error)
    })
    socket.once('timeout', () => {
      socket.destroy()
      reject(new Error(`Timed out checking ${QA_HOST}:${port}.`))
    })
  })
}

if (!process.exitCode && !process.env.PLAYWRIGHT_BASE_URL?.trim()) {
  for (const port of [QA_PORT, STUB_PORT]) {
    try {
      const portState = await inspectQaPort(port)
      if (portState === 'occupied') {
        fail(
          `The fixed QA address ${QA_HOST}:${port} is already in use.`,
          'Close the owning task normally and retry; do not choose another QA port or force-kill the process.'
        )
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      fail(
        `The environment cannot access the QA loopback address ${QA_HOST}:${port}: ${detail}`,
        'Run outside the restricted sandbox or allow local server/browser networking, then retry.'
      )
    }
  }
}
