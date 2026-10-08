import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

/**
 * proxy.ts decides two separate things, and conflating them caused a real
 * signed-in regression on ticker pages: `config.matcher` decides where
 * clerkMiddleware() RUNS, and isProtectedRoute decides where it PROTECTS.
 *
 * Where the middleware does not run, auth() throws and lib/auth.ts catches it,
 * so a signed-in visitor is silently rendered as signed out. These assertions
 * read the source rather than booting Clerk, so they need no credentials.
 */
function readProxySource(): string {
  return fs.readFileSync(path.join(process.cwd(), 'proxy.ts'), 'utf8')
}

/** Pull the string literals out of a named array literal in the source. */
function routeList(source: string, marker: string): string[] {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `expected to find ${marker} in proxy.ts`)
  const open = source.indexOf('[', start)
  const close = source.indexOf(']', open)
  assert.ok(open !== -1 && close !== -1, `expected an array literal after ${marker}`)
  return [...source.slice(open, close).matchAll(/'([^']+)'/g)].map((match) => match[1]!)
}

function matcherRoutes(source: string): string[] {
  return routeList(source, 'matcher:')
}

function protectedRoutes(source: string): string[] {
  return routeList(source, 'createRouteMatcher(')
}

test('ticker pages run clerkMiddleware so the viewer resolves', () => {
  const matcher = matcherRoutes(readProxySource())
  assert.ok(
    matcher.includes('/stocks(.*)'),
    'ticker pages call getViewerUserId(); without a matcher entry auth() throws and the viewer is rendered signed out'
  )
})

test('the calendar runs clerkMiddleware so a signed-in reader is not locked out', () => {
  const source = readProxySource()
  assert.ok(matcherRoutes(source).includes('/calendar(.*)'), 'the calendar calls isViewerSignedIn(); without a matcher entry every reader is rendered signed out')
  assert.ok(!protectedRoutes(source).some((route) => route.startsWith('/calendar')), 'the current week stays public')
})

test('ticker pages stay public', () => {
  const source = readProxySource()
  const guarded = protectedRoutes(source)

  for (const route of guarded) {
    assert.ok(
      !route.startsWith('/stocks'),
      `/stocks must never be protected; found ${route} in isProtectedRoute`
    )
  }
})

test('the existing protected routes remain protected', () => {
  const guarded = protectedRoutes(readProxySource())

  for (const route of ['/dashboard(.*)', '/api/watchlist(.*)', '/api/export-signals(.*)']) {
    assert.ok(guarded.includes(route), `${route} must stay protected`)
  }
})

test('every protected route is actually matched', () => {
  const source = readProxySource()
  const matcher = matcherRoutes(source)

  // A protected route missing from the matcher is protection that never runs,
  // which fails open rather than closed.
  for (const route of protectedRoutes(source)) {
    assert.ok(
      matcher.includes(route),
      `${route} is protected but not matched, so auth.protect() would never run for it`
    )
  }
})

test('protection is still decided by isProtectedRoute, not by the matcher', () => {
  const source = readProxySource()

  // Matching a route must not, on its own, protect it: every protect() call
  // has to sit behind the isProtectedRoute guard, and there must be no other.
  const protectCalls = [...source.matchAll(/auth\.protect\(\)/g)]
  assert.equal(protectCalls.length, 1, 'expected exactly one auth.protect() call')

  const guarded = [...source.matchAll(/if \(isProtectedRoute\(req\)\) await auth\.protect\(\)/g)]
  assert.equal(guarded.length, 1, 'the only auth.protect() must be guarded by isProtectedRoute')
})
