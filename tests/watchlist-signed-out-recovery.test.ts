import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

/**
 * Watchlist Save — Signed-out Recovery V1.
 *
 * This component has no DOM-level coverage available: the repository's unit
 * runner is `node --test` over compiled TypeScript, with no renderer and no
 * jsdom, and the accepted scope forbids adding a dependency. So the behaviours
 * that carry product meaning are asserted against the source contract, in the
 * same manner as tests/ticker-page-architecture.test.ts. The rendered
 * behaviour is covered separately by e2e/watchlist-signed-out-recovery.spec.ts.
 */
function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

/** The body of the signed-out branch of the click handler. */
function signedOutBranch(source: string): string {
  const start = source.indexOf('if (!signedIn) {')
  assert.notEqual(start, -1, 'signed-out branch must guard the click handler')
  const end = source.indexOf('setPending(true)', start)
  assert.notEqual(end, -1, 'the signed-in mutation must follow the signed-out branch')
  return source.slice(start, end)
}

test('founder-approved copy appears verbatim', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  for (const copy of [
    'Sign in to save this ticker to your watchlist.',
    'Saving…',
    'Removing…',
    'Saved to watchlist.',
    'Removed from watchlist.',
    'Couldn’t update your watchlist. Try again.',
  ]) {
    assert.ok(source.includes(copy), `missing approved copy: ${copy}`)
  }

  assert.match(source, /const SIGN_IN_LABEL = 'Sign in'/)
  assert.match(source, /const CREATE_ACCOUNT_LABEL = 'Create account'/)

  // The generic message replaces any raw upstream message in the reader's view.
  assert.doesNotMatch(source, /setError\(err/)
  assert.doesNotMatch(source, /Failed to update watchlist/)
})

test('a signed-out activation opens recovery and never touches the watchlist API', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')
  const branch = signedOutBranch(source)

  assert.match(branch, /setRecoveryOpen/, 'signed-out click opens the recovery state')
  assert.match(branch, /\breturn\b/, 'signed-out click returns before any mutation')
  assert.doesNotMatch(branch, /callWatchlistApi|fetch\(/, 'no request may be attempted while signed out')

  // Signed out is recovery, not an error: it must not set the error line.
  assert.doesNotMatch(branch, /setError\(/)

  // A boolean cannot accumulate, so repeat activation cannot stack states.
  assert.match(source, /const \[recoveryOpen, setRecoveryOpen\] = useState\(false\)/)
  assert.match(source, /setRecoveryOpen\(\(open\) => !open\)/)
  assert.match(source, /\{!signedIn && recoveryOpen && \(/)
})

test('both recovery actions resolve to the existing auth routes with no return-to plumbing', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  assert.match(source, /href="\/sign-in"/)
  assert.match(source, /href="\/sign-up"/)

  // R-2: no redirect parameters, no return-to logic, no auth plumbing.
  assert.doesNotMatch(source, /redirect_url|returnTo|return_to|redirectTo|callbackUrl/)

  // No navigation is triggered by the click itself.
  assert.doesNotMatch(source, /useRouter|router\.(push|replace)|window\.location|redirect\(/)

  // Sign in is primary; Create account is visually subordinate.
  assert.match(source, /buttonClass\(\{ variant: 'primary', size: 'sm' \}\)/)
  assert.match(source, /buttonClass\(\{ variant: 'ghost', size: 'sm' \}\)/)
})

test('the signed-in mutation path is semantically unchanged', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  assert.match(source, /fetch\('\/api\/watchlist', \{/)
  assert.match(source, /body: JSON\.stringify\(\{ ticker \}\)/)
  assert.match(source, /callWatchlistApi\(nextState \? 'POST' : 'DELETE', ticker\)/)

  // State still follows a successful response — saving is not optimistic.
  const mutation = source.slice(source.indexOf('try {'), source.indexOf('} finally {'))
  assert.match(mutation, /await callWatchlistApi[\s\S]*setInWatchlist\(nextState\)/)
  assert.doesNotMatch(
    mutation.slice(0, mutation.indexOf('await callWatchlistApi')),
    /setInWatchlist/,
    'the control must never show a falsely saved state'
  )

  // A failed request leaves the prior state untouched.
  const failure = mutation.slice(mutation.indexOf('} catch'))
  assert.doesNotMatch(failure, /setInWatchlist/)

  // The signed-in path never shows the signed-out recovery state.
  assert.doesNotMatch(mutation, /setRecoveryOpen/)
})

test('pending is visible, blocks re-entry, and does not move the surrounding layout', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  assert.match(source, /disabled=\{pending\}/, 're-entry is prevented while pending')
  assert.match(source, /aria-busy=\{pending\}/)

  // Conveyed by a swapped icon inside the fixed-size control, not by dimming
  // alone and without changing the control's geometry.
  assert.match(source, /\{pending \? \([\s\S]*Loader2 size=\{16\}[\s\S]*: \([\s\S]*Star\s+size=\{16\}/)
  assert.match(source, /animate-spin/)
})

test('outcomes are announced through polite live regions', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  assert.match(source, /className="sr-only" role="status" aria-live="polite"/)
  assert.match(source, /setAnnouncement\(nextState \? SAVING_ANNOUNCEMENT : REMOVING_ANNOUNCEMENT\)/)
  assert.match(source, /setAnnouncement\(nextState \? SAVED_ANNOUNCEMENT : REMOVED_ANNOUNCEMENT\)/)
  assert.match(source, /aria-live="polite"[\s\S]*signal-bearish/, 'the error line announces itself')

  // The control keeps an accurate name and programmatic pressed state.
  assert.match(source, /aria-label=\{label\}/)
  assert.match(source, /aria-pressed=\{inWatchlist\}/)

  // The disclosure is exposed, and only where it exists.
  assert.match(source, /aria-expanded=\{signedIn \? undefined : recoveryOpen\}/)
})

test('the recovery state is keyboard escapable and offers focus sensibly', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /starRef\.current\?\.focus\(\)/, 'dismissal returns focus to the control')
  assert.match(source, /if \(recoveryOpen\) signInRef\.current\?\.focus\(\)/)
})

test('error presentation uses the existing semantic token and caption utility', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  assert.match(source, /signal-bearish/)
  assert.match(source, /text-caption/)

  // The raw Tailwind red and the hardcoded caption size are gone.
  assert.doesNotMatch(source, /text-red-\d00/)
  assert.doesNotMatch(source, /text-\[12px\]/)

  // Not conveyed by colour alone.
  assert.match(source, /CircleAlert/)
})

test('the star geometry and the control rail are preserved', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')
  const styles = readRepoFile('components/stocks/StockTickerIdentity.module.css')
  const chrome = readRepoFile('components/stocks/StockTickerChrome.tsx')

  // R-3: the existing 36px control is not resized or redesigned.
  assert.match(source, /inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full/)
  assert.match(source, /fill-\[var\(--text-muted\)\] text-\[var\(--text-muted\)\]/)

  // The only call site is unchanged: the chrome hands it to the identity's actions.
  assert.match(chrome, /actions=\{\([\s\S]*<WatchlistButton/)

  // R-7: the chrome change is layout integration, scoped to the recovery state.
  assert.match(styles, /\.body:has\(\[data-watchlist-recovery='open'\]/)
  assert.doesNotMatch(styles, /\.(rail|actions) \{[^}]*(width|height|padding|font-size)/)
})

test('no new dependency, primitive or design token is introduced', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1])
  assert.deepEqual(imports.sort(), [
    '@/components/ui/Button',
    'lucide-react',
    'next/link',
    'react',
  ])

  // No modal, dialog, drawer or overlay system.
  assert.doesNotMatch(source, /Dialog|Modal|Drawer|createPortal|role="dialog"/)

  // No analytics (R-6): V1 adds none.
  assert.doesNotMatch(source, /analytics|trackEvent|gtag|plausible/i)
})
