# HTTP boundary experiment — Part of ENG-196

Review gate: this PR adds only isolated fixtures and a reproducible experiment.
It does not rewrite production pages, add a Proxy fetch or deploy anything.
Run `npm run qa:http-boundary` in a clean Node 22 container with network disabled,
UID 1000, read-only root filesystem/dependencies and a private TMPDIR. The harness
owns ports 3100/3101 and shuts down both servers. It builds Next 16.2.12 with
webpack in production mode, then makes real HTTP requests to `next start`.

## Observed matrix

| Design | Upstream 200 | Upstream 429 | Upstream 503 | Required calls on failure | Retry-After |
| --- | --- | --- | --- | --- | --- |
| App Router streaming + fallback UI | 200 | 200 | 200 | 1 | absent |
| App Router blocking layout + throw | 200 | 500 | 500 | 2 | absent |
| Pages Router getServerSideProps | 200 | 429 | 503 | 1 | preserved |
| App Router Route Handler (JSON) | 200 | 429 | 503 | 1 | preserved |

The blocking-layout negative control made two mandatory reads during error
rendering despite request-render React cache. This observation is scoped to this
Next version and fixture, not a claim that every layout always duplicates work.
Moving await before the first byte is insufficient to select arbitrary HTTP
status and Retry-After through a documented page API. Streaming fallback UI
reproduces the existing misleading success response. JSON Route Handlers control
HTTP correctly but do not replace a hydrated React page and its layouts by
themselves. Wrapping internal page rendering or patching Next internals adds an
unsupported boundary; no such workaround is recommended.

## Recommendation for review

Use getServerSideProps only for ticker routes that need this strict HTTP contract,
with one request-scoped loader of mandatory data and a server-safe transport that
accepts explicit verified request context. Reuse its result as props for header,
metadata and main content. Preserve SSR; defer only optional interactions.
Do not migrate other surfaces or load backend data in Proxy. App and Pages routers
can coexist, but crossing between them can cause full navigation and lost shared
layout state. Prototype the existing ticker chrome, metadata, watchlist, motion,
mobile tab navigation and charts before approving that implementation.

The fixture deliberately separates `loadRequired` from `loadApp`: Pages Router
cannot reuse next/headers or App Router auth() helpers. Real migration must use
the appropriate Clerk server integration, preserve rejection of invalid sessions,
forward the verified token, and obtain visitor IP only from Vercel's overwritten
platform header. There is no new universal service identity or auth bypass.

## Evidence and limits

The mandatory read is reused between layout/metadata/page in App Router; Pages
loads it once and shares its result. An optional 503 leaves successful SSR at 200;
failed mandatory loads never start the optional request. SSR/JSON errors are
private,no-store and preserve a supplied Retry-After, falling back to 60 seconds.
Additional checks cover anonymous requests, HTTP-date Retry-After and forged
identity refusal. No 429/503 is automatically retried.

The backend fixture validates the original synthetic bearer identity and the
HMAC produced by the actual production `signVisitorIP` helper, including visitor
IP, method, path, timestamp and request ID. The harness transpiles that source at
runtime instead of maintaining a second signing implementation. An unrelated
X-Forwarded-For does not choose the visitor IP. All keys/tokens are ephemeral and
never printed. This proves transport preservation in isolation; it does not prove
Clerk token validation, Cloudflare Access policy, Vercel header overwriting or
multi-instance behavior in production. Those need integration/Preview evidence
before rewriting the production pages, plus Francisco's review of this result.
