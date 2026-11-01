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

## Phased policy — proposal pending Francisco's confirmation

Phase 1: keep Vercel AI Bots Managed Ruleset in Deny until frontoffice PRs #83,
#84 and #86 are in production. Per Francisco it has been Deny since 2026-10-26
22:54 UTC and cut backend calls by about 99%; these are supplied operational
facts, not measurements reproduced here. The Vercel owner handles Attack
Challenge Mode. This PR changes no Firewall configuration.

Phase 2 target in this PR: Googlebot and Bingbot keep the full ordinary public
allowlist above. OAI-SearchBot, Claude-SearchBot and PerplexityBot may crawl only
`/`, `/product`, `/pricing`, `/faq`, `/about` and `/stocks/{ticker}`; necessary
static assets and robots/sitemap remain accessible. Their specific group repeats
all exclusions because it replaces the wildcard group. Markets and Picks remain
in the general search sitemap but are excluded from these AI-search agents.
One sitemap advertises the general public indexable set; it is not an access
grant to every crawler. APIs, accounts, query variants and all ticker subpages
remain excluded for every permitted search crawler.

Training/use-control tokens, on-demand agents and AI search operators outside
the three explicitly approved agents get deny-all groups. This includes
ChatGPT-User, Claude-User and Perplexity-User. Search permission does not imply
permission for the corresponding user-triggered fetcher; some answers may still
fail to fetch a live page. Do not promise complete chatbot reachability.

The phase-2 robots proposal does not override phase-1 edge Deny. Activation and
narrow verified exceptions, rule order and Allow/Bypass effects belong to the
Vercel agent, after Francisco's confirmation. Do not use a broad bypass that
silently removes traffic controls. Even permitted search traffic can share or
rotate operator IPs and hit existing backend budgets; measure this before edge
activation rather than increasing anonymous quotas. ENG-225 backend PR #68
proposes separate operator admission; no such mechanism is implemented here.

Phase 3 (ENG-225): authenticated API/MCP access under approved projections,
entitlements and budgets; separate product decision, not part of this PR.

## Operator token audit

Checked **2026-10-27** against the official pages linked below. These are operator
statements, not observed compliance tests. No UA string establishes identity.

| Tokens in policy | Purpose and robots behavior | Official source |
| --- | --- | --- |
| `Googlebot` | Ordinary search; respects REP. General public allowlist. | [Google common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| `Bingbot` (HTTP UA `bingbot`) | Ordinary search; respects robots. General public allowlist. | [Bing crawlers](https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0) |
| `OAI-SearchBot`, `GPTBot` | Separate search/training controls; allow only the first on the restricted set. | [OpenAI bots](https://developers.openai.com/api/docs/bots) |
| `ChatGPT-User` | Certain user-initiated fetches; robots rules **may not apply**. Deny is a preference, requiring edge enforcement. | [OpenAI bots](https://developers.openai.com/api/docs/bots) |
| `Claude-SearchBot`, `ClaudeBot`, `Claude-User` | Search, training, on-demand respectively. Anthropic declares robots compliance for all three, including User. Only SearchBot is allowed selectively. | [Anthropic Privacy Center](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) |
| `PerplexityBot`, `Perplexity-User` | Search respects robots; User generally **ignores robots**. Only Bot is allowed selectively. Neither is described as a foundation-model training crawler. | [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) |
| `Google-Extended` | Robots usage-control token, no separate HTTP UA. Controls Gemini training and certain grounding uses, not Google Search inclusion/ranking. Denied. | [Google common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| `Google-Agent`, `Google-GeminiNotebook` | User-triggered fetchers generally **ignore robots**; denied preference only. Current Notebook token replaces Google-NotebookLM, supported only until August 2026. | [Google user-triggered fetchers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| `Applebot-Extended` | Robots training-use token; does not crawl itself. Blocking it does not block Apple search. Denied. | [Applebot](https://support.apple.com/en-us/119829) |
| `CCBot` | Common Crawl corpus collection; operator documents robots opt-out. Denied. | [Common Crawl](https://commoncrawl.org/ccbot) |
| `meta-externalagent`, `meta-externalads`, `meta-webindexer` | Model/product collection, advertising and AI-search indexing respectively; official robots controls. All denied; WebIndexer is not an approved search exception. | [Meta crawlers](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/) |
| `meta-externalfetcher` | On-demand/agentic fetches; **may bypass robots**. Denied preference only. | [Meta crawlers](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/) |
| `Amazonbot`, `Amzn-SearchBot`, `Amzn-User` | Training/product improvement, search and on-demand respectively. Automated crawls respect REP; User **may not follow all directives**. All denied; Amazon search is outside the approved three. | [Amazon bots](https://developer.amazon.com/en/amazonbot) |
| `Diffbot`, `Diffbot-User` | Search/knowledge graph and on-demand; not foundation-model training per operator. Robots respected by default, but hosted crawls can override it. Both denied. | [Diffbot robots FAQ](https://www.diffbot.com/docs/crawl/faq/robots-txt) |
| `Bytespider` | Token confirmed in official Toutiao documentation. That page describes search, not an explicit AI-training purpose, and does not establish robots compliance. Denied; compliance **unconfirmed**, not asserted to ignore REP. | [Toutiao: About Bytespider](https://zhanzhang.toutiao.com/docs/intro/26899) |
| `anthropic-ai`, `cohere-ai` | Existing precautionary deny tokens. Current operator documentation confirming these exact tokens/robots behavior was **not found**. Do not represent them as verified current training identities. | [Anthropic current token list](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler); no matching Cohere primary page found |

Meta and Toutiao pages could not be fetched by the web tool but were read
directly from the official URLs with HTTP 200. Other tokens above were checked
on the linked official pages. The two precautionary legacy tokens remain an
explicit evidence gap, not a claim of official confirmation. Unknown or future
AI operators cannot be exhaustively denied by a finite robots token list.
The inline legacy-token comments explicitly state that these two tokens do not
count as protection. Per Francisco, Bytespider remains blocked by the Vercel
AI Bots rule independently of robots compliance; this PR does not change or
independently verify that Firewall configuration.

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
general-search accessibility of every generated URL, restricted AI-search access,
blocked-token denial, private/heavy paths,
query variants, ticker normalization and truthful modification metadata.
Production robots/sitemap delivery, indexing and Firewall behavior require owner
verification after review/deployment; no production changes are included.
