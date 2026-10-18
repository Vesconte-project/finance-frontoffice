import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'
import {resolve} from 'node:path'
loadEnvConfig(process.cwd(), true)
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')) throw Error('Local browser tests require Clerk Development keys')
process.env.CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
export default defineConfig({
  testDir: './e2e/local', testMatch: 'native-cutover.spec.ts',
  timeout: 35 * 60_000, workers: 1, retries: 0,
  outputDir: 'test-results/local', reporter: 'line',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3000', trace: 'off', video: 'off', screenshot: 'off' },
  webServer: [{ command: 'npm run dev:local',env:{FINANCE_LOCAL_CANDIDATE:'true',FINANCE_LOCAL_PROJECT:'finance-local-eng196'}, url: 'http://localhost:3000', reuseExistingServer: false,
    timeout: 45 * 60_000, stdout: 'pipe', stderr: 'pipe', gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 } },
    {command:'npm run dev:platform',cwd:resolve(process.env.FINANCE_REPOS_DIR || '..','finance-backoffice'),
      env:{FINANCE_LOCAL_PROFILE:'dev-local'},url:'http://localhost:3101/sign-in',reuseExistingServer:false,
      timeout:120_000,stdout:'pipe',stderr:'pipe',gracefulShutdown:{signal:'SIGTERM',timeout:10_000}}],
})
