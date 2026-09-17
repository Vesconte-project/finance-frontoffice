import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { FAQ_GROUPS, FAQ_ITEMS, faqAnswerText, faqPageJsonLd } from '../lib/faq-content'

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

const ANSWERS = FAQ_ITEMS.map((item) => faqAnswerText(item))

/**
 * The guard that would have caught A1. The FAQ told readers to "use the screener
 * to filter and sort companies" while the screener route renders "Signals is in
 * development.", sets `robots.index === false`, and is excluded from the sitemap.
 * This asserts the two surfaces cannot disagree again without a test failing.
 */
test('no answer offers the screener while the screener route is noindex', () => {
  const screener = readRepoFile('app/(app)/screener/page.tsx')
  const isNoindex = /robots:\s*\{[^}]*index:\s*false/s.test(screener)
  assert.equal(isNoindex, true, 'screener route is expected to still be noindex; re-read this guard if it opened')

  for (const answer of ANSWERS) {
    const mentionsScreener = /screener/i.test(answer)
    if (!mentionsScreener) continue
    // One mention is allowed, and only as the retired thing being replaced.
    assert.match(
      answer,
      /rather than extended from the earlier screener/,
      `an answer mentions the screener as something other than the retired surface: ${answer}`
    )
  }
})

test('no answer routes a reader to the locked market-wide surface', () => {
  // The route, not the backend path it reads from and not the comment explaining
  // the omission: only a `${baseUrl}/screener` entry would publish it.
  const sitemap = readRepoFile('app/sitemap.ts')
  assert.equal(
    /\$\{baseUrl\}\/screener/.test(sitemap),
    false,
    'the screener is expected to stay out of the sitemap'
  )

  for (const answer of ANSWERS) {
    assert.equal(
      /use the screener|open the screener|in the screener/i.test(answer),
      false,
      `an answer sends a reader to the screener: ${answer}`
    )
  }
})

/**
 * The guard that keeps Q-1's open gap from being quietly re-closed by future copy.
 * The real signal-history cadence is backend semantics and is not verifiable from
 * this repository, so the page asserts no frequency at all. An answer that says
 * "daily", "hourly", "every morning" and so on would be restating an unverified
 * figure as product truth.
 */
test('no answer asserts a data update cadence', () => {
  const cadenceClaims = [
    /\bdaily\b/,
    /\bhourly\b/,
    /\bweekly\b/,
    /\bmonthly\b/,
    /\bintraday\b(?!\s+execution)/,
    /\bevery (?:day|morning|hour|week|night)\b/,
    /\bonce a (?:day|week|month)\b/,
    /\breal[- ]time\b/,
    /\bupdated (?:every|each)\b/,
    /\btimes per (?:day|week)\b/,
  ]

  for (const answer of ANSWERS) {
    for (const claim of cadenceClaims) {
      assert.equal(
        claim.test(answer.toLowerCase()),
        false,
        `an answer asserts an update cadence (${claim}): ${answer}`
      )
    }
  }
})

/**
 * The FAQ contradicted itself two answers apart: it offered a Pro CSV export as a
 * current entitlement while also saying paid access was being prepared, and while
 * the pricing page calls its plans planned direction rather than entitlements.
 */
test('no answer presents a paid tier as a current entitlement', () => {
  const pricing = readRepoFile('components/marketing/PricingPage.tsx')
  assert.match(
    pricing,
    /not current entitlements/,
    'pricing is expected to still describe its plans as planned direction'
  )

  const exportAnswer = FAQ_ITEMS.find((item) => item.slug === 'export-data')
  assert.ok(exportAnswer, 'the export answer is expected to exist')
  assert.match(
    exportAnswer.answer,
    /not yet available to buy|cannot use today|is not something a new account can use today/,
    'the export answer must say the Pro capability is not purchasable today'
  )

  const planAnswer = FAQ_ITEMS.find((item) => item.slug === 'paid-plan')
  assert.ok(planAnswer, 'the paid plan answer is expected to exist')
  assert.match(
    faqAnswerText(planAnswer),
    /not current entitlements/,
    'the paid plan answer must echo the pricing page wording so the two cannot drift'
  )
})

test('no answer names the retired Signal History route', () => {
  const redirect = readRepoFile('app/(app)/stocks/[ticker]/signal-history/page.tsx')
  assert.match(redirect, /permanentRedirect/, 'signal-history is expected to still be a redirect')

  for (const answer of ANSWERS) {
    assert.equal(
      /signal history page/i.test(answer),
      false,
      `an answer names the retired Signal History page: ${answer}`
    )
  }
})

/**
 * This is what stops the visible answers and the structured data drifting. Both
 * come from FAQ_GROUPS, so the assertion is that the serialiser really does walk
 * the same constant rather than a copy someone updated once.
 */
test('the FAQPage structured data carries exactly the rendered question set', () => {
  const parsed = JSON.parse(faqPageJsonLd()) as {
    '@type': string
    mainEntity: { '@type': string; name: string; acceptedAnswer: { '@type': string; text: string } }[]
  }

  assert.equal(parsed['@type'], 'FAQPage')
  assert.deepEqual(
    parsed.mainEntity.map((entry) => entry.name),
    FAQ_ITEMS.map((item) => item.question)
  )
  assert.deepEqual(
    parsed.mainEntity.map((entry) => entry.acceptedAnswer.text),
    ANSWERS
  )

  for (const entry of parsed.mainEntity) {
    assert.equal(entry['@type'], 'Question')
    assert.equal(entry.acceptedAnswer['@type'], 'Answer')
    assert.ok(entry.acceptedAnswer.text.length > 0, `empty answer for ${entry.name}`)
  }
})

/**
 * The Snapshot's copy is ASCII apostrophes throughout — fourteen of them, no
 * typographic ones. Invariant 7 asks for verbatim transcription, and an earlier
 * revision of this change substituted typographic apostrophes for typographic
 * consistency with the surrounding page. That reasoning compared against the
 * live page rather than the accepted subject. company-os#84 records the rule
 * permanently; this asserts it so it is not re-decided each cycle.
 */
test('the copy uses ASCII apostrophes, exactly as the Snapshot does', () => {
  for (const item of FAQ_ITEMS) {
    const text = `${item.question} ${faqAnswerText(item)}`
    assert.equal(
      text.includes('’'),
      false,
      `typographic apostrophe in ${item.slug}; the Snapshot uses ASCII`
    )
  }
})

test('every question has a unique, URL-safe anchor', () => {
  const slugs = FAQ_ITEMS.map((item) => item.slug)
  assert.equal(new Set(slugs).size, slugs.length, 'question anchors must be unique')
  for (const slug of slugs) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `anchor is not URL-safe: ${slug}`)
  }
})

test('the answer text folds the inline link back into the sentence', () => {
  const account = FAQ_ITEMS.find((item) => item.slug === 'need-an-account')
  assert.ok(account)
  // The rendering defect this replaces emitted "create an account ." with a space
  // before the full stop, so the joined text must not reintroduce one.
  assert.equal(faqAnswerText(account).includes(' .'), false)
  assert.match(faqAnswerText(account), /create an account\.$/)
})

test('the groups and their descriptions are the four the page ships', () => {
  assert.deepEqual(
    FAQ_GROUPS.map((group) => group.label),
    ['Product', 'Market data', 'Features', 'Account & plans']
  )
  for (const group of FAQ_GROUPS) {
    assert.ok(group.description.length > 0, `${group.label} is missing its description`)
    assert.ok(group.items.length > 0, `${group.label} has no questions`)
  }
  assert.equal(FAQ_ITEMS.length, 20, 'the accepted Snapshot specifies twenty answers')
})

/**
 * The reduced-motion override is coupled to the accordion markup by selector.
 * Dropping `role="region"` from the panels would have silently broken it, so the
 * selector and the class it targets are asserted together.
 */
test('the reduced-motion override still matches the accordion markup', () => {
  const css = readRepoFile('app/globals.css')
  const accordion = readRepoFile('components/marketing/FaqAccordion.tsx')

  assert.match(css, /\.marketing-faq \.faq-accordion :is\([^)]*\.faq-accordion__panel[^)]*\)/)
  assert.match(accordion, /faq-accordion__panel/)
  assert.equal(
    /role="region"/.test(accordion),
    false,
    'twenty region landmarks is what the APG advises against past six panels'
  )
})

test('the route emits view_faq and structured data from the shared constant', () => {
  const route = readRepoFile('app/(marketing)/faq/page.tsx')
  assert.match(route, /eventName="view_faq"/)
  assert.match(route, /application\/ld\+json/)
  assert.match(route, /faqPageJsonLd\(\)/)
  assert.match(route, /alternates:\s*\{\s*canonical:\s*'\/faq'\s*\}/)
  assert.match(route, /openGraph:/)

  const events = readRepoFile('lib/analytics-events.ts')
  assert.match(events, /'view_faq'/, 'a name must be registered in the event vocabulary to be emitted')
})

test('the page renders one h1 and no skipped heading level', () => {
  const page = readRepoFile('components/marketing/FaqPage.tsx')
  const accordion = readRepoFile('components/marketing/FaqAccordion.tsx')

  assert.equal((page.match(/<h1\b/g) ?? []).length, 1, 'the route must render exactly one h1')
  assert.equal((page.match(/<h2\b/g) ?? []).length, 0, 'group headings belong to the accordion')
  assert.match(accordion, /<h2\b/, 'groups are h2')
  assert.match(accordion, /<h3 className="m-0">/, 'each question trigger is wrapped in an h3')
})
