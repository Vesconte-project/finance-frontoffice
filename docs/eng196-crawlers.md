# Public crawling policy — Part of ENG-196

The sitemap and robots policy share `lib/crawl-policy.ts`. Index the canonical
institutional pages (`/`, `/product`, `/pricing`, `/faq`, `/about`), `/markets`,
the four public Picks landing pages (including their anonymous previews), and
only `/stocks/{ticker}`. Community is an unavailable placeholder; redirect
aliases, models/research, calendars and personal/authenticated pages are absent.
All ticker subpages, including events, ownership, relationships, signals and
financials, and query variants are disallowed: the overview is the search entry
point; detail views multiply backend work and add little discovery value.
Rendering assets remain crawlable. This is a crawl allowlist, not access control.

AI robots product tokens have a separate deny-all group, including Google-Extended
(which has no separate HTTP User-Agent). There are no new manual Firewall rules.
Per Francisco, Vercel AI Bots Managed Ruleset has been Deny since 2026-10-26
22:54 UTC and cut backend calls by about 99%; this is supplied operational
context, not a production measurement reproduced by this PR. Attack Challenge
Mode will be disabled by the owner. Google/Bing use the ordinary crawl allowlist.

No Crawl-delay promise: Google ignores it. Actual protection is Vercel Firewall,
backend admission/rate budgets, and cache behind admission. robots.txt is voluntary
and never establishes confidentiality. A disallowed URL can still appear in
search; removing already indexed URLs needs a separate noindex/removal plan.

Sitemap generation still makes at most one backend ticker-index request. Ticker
page calls do not change in this PR. No guessed lastModified timestamps are
published; the index does not supply a content modification date. Failed ticker
index reads preserve the useful static entries. No authenticated response is
newly cached and the backend helper's no-store policy is unchanged.

Validation: `npm run verify`; crawler tests evaluate longest-match precedence,
search accessibility of every generated URL, AI token denial, private/heavy paths,
query variants, ticker normalization and truthful modification metadata.
Production robots/sitemap delivery, indexing and Firewall behavior require owner
verification after review/deployment; no production changes are included.
