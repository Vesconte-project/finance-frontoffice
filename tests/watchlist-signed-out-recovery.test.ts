import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

/**
 * Watchlist Save — Signed-out Recovery V1, revised 2026-10-03: the founder
 * replaced the in-place recovery panel with a modal account prompt that says
 * what a free account gives. Everything else in V1 stands.
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

  assert.match(branch, /setRecoveryOpen\(true\)/, 'signed-out click opens the account prompt')
  assert.match(branch, /\breturn\b/, 'signed-out click returns before any mutation')
  assert.doesNotMatch(branch, /callWatchlistApi|fetch\(/, 'no request may be attempted while signed out')

  // Signed out is recovery, not an error: it must not set the error line.
  assert.doesNotMatch(branch, /setError\(/)

  // A boolean cannot accumulate, so repeat activation cannot stack states.
  assert.match(source, /const \[recoveryOpen, setRecoveryOpen\] = useState\(false\)/)
  assert.match(source, /\{!signedIn && \(\s*<Dialog\s+open=\{recoveryOpen\}/)
})

test('both recovery actions resolve to the existing auth routes with no return-to plumbing', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  assert.match(source, /href="\/sign-in"/)
  assert.match(source, /href="\/sign-up"/)

  // R-2: no redirect parameters, no return-to logic, no auth plumbing.
  assert.doesNotMatch(source, /redirect_url|returnTo|return_to|redirectTo|callbackUrl/)

  // No navigation is triggered by the click itself.
  assert.doesNotMatch(source, /useRouter|router\.(push|replace)|window\.location|redirect\(/)

  // Creating an account is the primary action; signing in is subordinate.
  assert.match(source, /href="\/sign-up"[\s\S]*?variant: 'primary'[\s\S]*?href="\/sign-in"[\s\S]*?variant: 'ghost'/)

  // What the account gives is stated from the real entitlement, not a guess.
  assert.match(source, /PICK_VISIBLE_LIMITS\.free/)
  assert.match(source, /PICK_VISIBLE_LIMITS\.anonymous/)
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
  // A failure opens a dialog that names and describes itself with the approved copy.
  assert.match(source, /open=\{error !== null\}/)
  assert.match(source, /description=\{`\$\{MUTATION_ERROR\}/)

  // The control keeps an accurate name and programmatic pressed state.
  assert.match(source, /aria-label=\{label\}/)
  assert.match(source, /aria-pressed=\{inWatchlist\}/)

  // The dialog trigger is exposed, and only where it exists.
  assert.match(source, /aria-haspopup=\{signedIn \? undefined : 'dialog'\}/)
  assert.match(source, /aria-expanded=\{signedIn \? undefined : recoveryOpen\}/)
})

test('the account prompt is a real modal: focus moves in, Escape closes, focus returns', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')
  const dialog = readRepoFile('components/ui/Dialog.tsx')

  assert.match(source, /initialFocusRef=\{createAccountRef\}/, 'opening offers focus to the primary action')
  assert.match(source, /returnFocusRef=\{starRef\}/, 'dismissal returns focus to the star')
  assert.match(source, /labelledBy=\{titleId\}/)

  // The native modal dialog contains focus, makes the page inert and closes on Escape.
  assert.match(dialog, /<dialog/)
  assert.match(dialog, /\.showModal\(\)/)
  assert.match(dialog, /returnFocusRef\?\.current\?\.focus\(\)/)
  // The page behind does not scroll while it is open.
  assert.match(dialog, /runtime\.acquireLock\(\)/)
})

test('a failed save or removal is shown in the shared dialog, never inline in the hero', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  // The same modal as the account prompt, drawn as unavailable, with a retry.
  assert.match(source, /tone="unavailable"/)
  assert.match(source, /onClick=\{retry\}/)
  assert.match(source, /initialFocusRef=\{retryRef\}/)

  // No inline error line pushes the hero apart, and no raw colour is used.
  assert.doesNotMatch(source, /signal-bearish/)
  assert.doesNotMatch(source, /text-red-\d00/)
  assert.doesNotMatch(source, /text-\[12px\]/)
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

  // The prompt is a modal, so it never changes the hero's layout.
  assert.doesNotMatch(styles, /data-watchlist-recovery/)
  assert.doesNotMatch(styles, /\.(rail|actions) \{[^}]*(width|height|padding|font-size)/)
})

test('no new dependency or design token is introduced; the modal is the shared primitive', () => {
  const source = readRepoFile('components/WatchlistButton.tsx')

  const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1])
  assert.deepEqual(imports.sort(), [
    '@/components/ui/Button',
    '@/components/ui/Dialog',
    '@/components/ui/PromptPanel',
    '@/lib/picks-access-rules',
    'lucide-react',
    'next/link',
    'react',
  ])

  // One modal primitive, no ad-hoc overlay, portal or drawer.
  assert.doesNotMatch(source, /Modal|Drawer|createPortal|role="dialog"/)

  // No analytics (R-6): V1 adds none.
  assert.doesNotMatch(source, /analytics|trackEvent|gtag|plausible/i)
})
