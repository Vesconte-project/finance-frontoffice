import assert from 'node:assert/strict'
import test from 'node:test'
import { siteBaseUrl, siteOrigin } from '../lib/site-url'

function withEnv(env: Record<string, string | undefined>, run: () => void): void {
  const keys = ['NEXT_PUBLIC_APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL'] as const
  const original: Record<string, string | undefined> = {}
  for (const key of keys) original[key] = process.env[key]

  try {
    for (const key of keys) {
      const value = env[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    run()
  } finally {
    for (const key of keys) {
      const value = original[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('explicit configuration wins', () => {
  withEnv(
    { NEXT_PUBLIC_APP_URL: 'https://vesconte.com', VERCEL_PROJECT_PRODUCTION_URL: 'finance-frontend.vercel.app' },
    () => {
      assert.equal(siteOrigin(), 'https://vesconte.com')
      assert.equal(siteBaseUrl(), 'https://vesconte.com')
    }
  )
})

test("Vercel's production domain is used when nothing is configured", () => {
  withEnv({ VERCEL_PROJECT_PRODUCTION_URL: 'finance-frontend.vercel.app' }, () => {
    // The platform value carries no scheme, so one is added.
    assert.equal(siteOrigin(), 'https://finance-frontend.vercel.app')
  })
})

test('a project rename is followed without a code change', () => {
  withEnv({ VERCEL_PROJECT_PRODUCTION_URL: 'spy-signal-site.vercel.app' }, () => {
    assert.equal(siteOrigin(), 'https://spy-signal-site.vercel.app')
  })
  withEnv({ VERCEL_PROJECT_PRODUCTION_URL: 'finance-frontend.vercel.app' }, () => {
    assert.equal(siteOrigin(), 'https://finance-frontend.vercel.app')
  })
})

test('local development falls back to localhost, not to a guessed domain', () => {
  withEnv({}, () => {
    assert.equal(siteOrigin(), 'http://localhost:3000')
  })
})

test('blank and unusable values fall through to the next source', () => {
  withEnv({ NEXT_PUBLIC_APP_URL: '   ', VERCEL_PROJECT_PRODUCTION_URL: 'finance-frontend.vercel.app' }, () => {
    assert.equal(siteOrigin(), 'https://finance-frontend.vercel.app')
  })
  withEnv({ NEXT_PUBLIC_APP_URL: 'http://', VERCEL_PROJECT_PRODUCTION_URL: 'finance-frontend.vercel.app' }, () => {
    assert.equal(siteOrigin(), 'https://finance-frontend.vercel.app')
  })
})

test('a base path is kept for absolute URLs but never in the origin', () => {
  withEnv({ NEXT_PUBLIC_APP_URL: 'https://vesconte.com/app/' }, () => {
    assert.equal(siteBaseUrl(), 'https://vesconte.com/app')
    assert.equal(siteOrigin(), 'https://vesconte.com')
  })
})

test('a trailing slash never doubles up in a built URL', () => {
  withEnv({ NEXT_PUBLIC_APP_URL: 'https://vesconte.com/' }, () => {
    assert.equal(`${siteBaseUrl()}/sitemap.xml`, 'https://vesconte.com/sitemap.xml')
  })
})
