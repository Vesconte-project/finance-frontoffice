import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
    { NEXT_PUBLIC_APP_URL: 'https://www.vesconte.com', VERCEL_PROJECT_PRODUCTION_URL: 'finance-frontend.vercel.app' },
    () => {
      assert.equal(siteOrigin(), 'https://www.vesconte.com')
      assert.equal(siteBaseUrl(), 'https://www.vesconte.com')
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
  withEnv({ NEXT_PUBLIC_APP_URL: 'https://www.vesconte.com/app/' }, () => {
    assert.equal(siteBaseUrl(), 'https://www.vesconte.com/app')
    assert.equal(siteOrigin(), 'https://www.vesconte.com')
  })
})

test('a trailing slash never doubles up in a built URL', () => {
  withEnv({ NEXT_PUBLIC_APP_URL: 'https://www.vesconte.com/' }, () => {
    assert.equal(`${siteBaseUrl()}/sitemap.xml`, 'https://www.vesconte.com/sitemap.xml')
  })
})

test('homepage canonical metadata resolves against the configured public origin', () => {
  const layout = readFileSync('app/layout.tsx', 'utf8')
  const homepage = readFileSync('app/(marketing)/page.tsx', 'utf8')

  assert.match(layout, /metadataBase:\s*new URL\(siteOrigin\(\)\)/)
  assert.match(homepage, /alternates:\s*\{ canonical: '\/' \}/)
  assert.match(homepage, /openGraph:\s*\{ url: '\/' \}/)
})

test('security contact is published at the standard well-known path', () => {
  const security = readFileSync('public/.well-known/security.txt', 'utf8')

  assert.match(security, /^Contact: mailto:security@vesconte\.com$/m)
  assert.match(security, /^Canonical: https:\/\/www\.vesconte\.com\/\.well-known\/security\.txt$/m)
  assert.match(security, /^Expires: 2027-09-19T00:00:00Z$/m)
  assert.match(security, /^Preferred-Languages: en, pt$/m)
})
