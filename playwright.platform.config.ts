import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd(), true)
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'))
  throw Error('Platform browser tests require Clerk Development')
process.env.CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
export default defineConfig({
  testDir: './e2e/local', testMatch: 'platform-native.spec.ts',
  timeout: 35 * 60_000, workers: 1, retries: 0,
  outputDir: 'test-results/platform', reporter: 'line',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3000', actionTimeout: 30_000,
    navigationTimeout: 60_000, trace: 'off', video: 'off', screenshot: 'off' },
  webServer: { command: 'npm run dev:platform', url: 'http://localhost:3000', reuseExistingServer: false,
    timeout: 20 * 60_000, stdout: 'pipe', stderr: 'pipe', gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 } },
})
