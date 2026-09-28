import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim()
// The browser addresses the app server as localhost, and the app server does not
// pin a loopback hostname, because Next 16 middleware normalizes loopback
// request origins to localhost. Pinning 127.0.0.1 left the router comparing
// localhost against its literal init URL, so an internal middleware rewrite was
// misclassified as external and network-proxied back into the same server.
// Keeping both names aligned avoids that. The fixture backend is unaffected:
// nothing rewrites through it.
const baseURL = externalBaseUrl || 'http://localhost:3100'
const stubBaseUrl = `http://127.0.0.1:${process.env.E2E_BACKEND_STUB_PORT || 3101}`

// Frontend QA sets PLAYWRIGHT_SERVER_MODE=production so the browser suite runs
// against the production build `qa:frontend` has just produced, which is the
// runtime Vercel actually serves. The switch is explicit rather than keyed off
// CI, so a runner and a laptop can each choose either mode deliberately.
// Absent the variable, local `qa:browser` keeps using `next dev` exactly as
// before.
const useProductionServer = process.env.PLAYWRIGHT_SERVER_MODE?.trim() === 'production'

// Shared by both modes. BACKEND_SHARED_SECRET is not a credential: the proxy
// routes require it to be present before they will call upstream at all, and
// the fixture backend never reads it.
const appServerEnv = {
  BACKEND_BASE_URL: stubBaseUrl,
  BACKEND_SHARED_SECRET: 'e2e-fixture-not-a-secret',
}

const appServer = useProductionServer
  ? {
      // `npm run build` writes to the default .next directory, so this mode
      // must not override NEXT_DIST_DIR or `next start` would find no build.
      command: 'npm run start -- --port 3100',
      env: appServerEnv,
    }
  : {
      command: 'npm run dev -- --port 3100',
      env: { NEXT_DIST_DIR: '.next-playwright', ...appServerEnv },
    }

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Keep the local Next server responsive while several image/canvas routes
  // compile and Clerk hydrates. CI already uses one worker.
  workers: process.env.CI ? 1 : 2,
  reporter: 'line',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // The fixture backend starts first: the Market Universe page fetches its atlas
  // server-side, so the Next server must be able to reach it from the first
  // request. It serves repository-owned synthetic data only, and needs no
  // credentials and no external host.
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          command: 'node scripts/e2e-backend-stub.mjs',
          url: `${stubBaseUrl}/health`,
          reuseExistingServer: false,
          timeout: 30_000,
          stdout: 'pipe',
          stderr: 'pipe',
          gracefulShutdown: {
            signal: 'SIGTERM',
            timeout: 5_000,
          },
        },
        {
          ...appServer,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
          gracefulShutdown: {
            signal: 'SIGTERM',
            timeout: 5_000,
          },
        },
      ],
})
