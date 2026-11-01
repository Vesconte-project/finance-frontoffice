# Bounded reads and cancellation — Part of ENG-196

SSR makes one upstream attempt, including after 429/503. Existing one-time Clerk
401 token refresh is an authentication repair, not a rate-limit retry. Mutations
are never automatically replayed by the market read client.

Ticker history, technical series, ticker search and Atlas browser reads share
`read-client.ts`: at most three total GET attempts for 429/503, exponential
1s/2s pauses plus jitter, and a delay no shorter than Retry-After (seconds or HTTP
date). Invalid/missing Retry-After uses backoff. If the next pause exceeds 30s,
return the refusal to the UI rather than scheduling a long retry. Network errors,
other statuses and mutations have one attempt. Abort cancels paused retries.
Concurrent identical browser reads without a caller-owned AbortSignal share one
in-flight operation, with independently consumable cloned responses. Entries are
removed when settled; this is no shared server cache and does not bypass backend
admission. Requests with separate cancellation ownership are not coalesced.

The backend helper still forces no-store. Native AbortSignal deadline/caller
composition cancels the actual fetch, including body reads after headers. No
Promise.race leaves an unobserved request running. Credential, Clerk and signed
visitor-IP generation paths are unchanged. PlatformError now understands dates
as well as seconds, preserving its existing numeric-seconds public contract.

This PR does not fix page HTTP status or BFF status/header mappings: that is the
separately reviewed HTTP boundary work. Browser backoff applies when a route
actually reports 429/503. No Proxy data loading is introduced.

Validation: `npm run verify`, with injected clocks/randomness and mocked fetch
cancellation to prove bounds, ordering, no server repeats, no successful-read
replays, coalescing, independent response bodies and caller abort behavior.
