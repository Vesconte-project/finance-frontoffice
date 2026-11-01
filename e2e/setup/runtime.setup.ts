import { expect, test } from '@playwright/test'

// A broken auth instance/redirect invalidates hundreds of downstream assertions.
// Exercise the real application and SDK once; never replace or bypass Clerk.
test('public application and Clerk are ready before UI assertions', async ({ page, baseURL }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' })
  expect(new URL(page.url()).origin, 'QA must stay on the local app, not an auth error endpoint').toBe(new URL(baseURL!).origin)
  expect(response?.status(), 'QA homepage must return successful HTML before running UI tests').toBe(200)
  expect(response?.headers()['content-type']).toContain('text/html')
  await expect(page.locator('main')).toBeVisible()
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded),
    undefined, { timeout: 10_000 })
})
