# Suspended ticker pages

Part of ENG-172, phase 2a. Deploy after the backend summary exposes the live canonical lifecycle overlay. Phase 1 cutover PRs are unchanged.

The summary adds `lifecycle_state`, public translation code `suspension_reason`, UTC `suspended_at`, `review_by`, and a `lifecycle_revision`. Localized text lives in `lib/listing-lifecycle.ts`; audit approvals, evidence and actors are neither fetched nor rendered. The supplied Portuguese notice is deliberate; the rest of the established navigation is unchanged.

A suspended listing keeps its direct URL, identity, watchlist controls and adjusted price history through the suspension date. The header suppresses price, daily changes and currency-conversion quote requests. All ticker tabs/deep links use the same lifecycle boundary: while suspended they show dated history instead of frozen current scores, indicators, valuations or rankings. The review date is labelled as review, never a promise to resume. Unknown/missing lifecycle state, unknown public reason and missing suspension evidence render unavailable rather than old current indicators. Missing/unreadable history leaves the suspension notice visible with a specific empty/error message.

The shell remains synchronous and streams the lifecycle-dependent content through its own boundary. Backend request authentication, rate limits and the owned browser QA server configuration are unchanged. The screener/ranking exclusion is enforced by the backend before ranking, rather than hidden only in this UI.

## Delivery and verification

This UI does not gate the Model Lab 04 publication. The backend publisher's exclusion/manifest change does: install that before Wednesday. Install API and frontend together before presenting the suspended pages as current. Without the new API, this frontend fails closed; rollback loses the warning and must not be used to present suspended current metrics.

Offline `npm run verify` runs in a clean non-root Python 3.12 container with network none, read-only root, private tmpfs/TMPDIR and cached Node dependencies. Compare against the exact remote-main Git archive, not the canonical clone's preserved task branch. Lint has the same two pre-existing unused-variable warnings.

The owned Playwright runner uses only QASUSP synthetic fixtures and existing local Clerk Development keys held in the process, never copied into Git. It checks the notice, reason, historical boundary, absent current price, old rankings deep link and overflow at 390, 1366 and 1920 CSS pixels. Screenshots are captured after the existing chart animation. The standard anonymous Clerk runtime preflight runs too. This confirms the browser with synthetic inputs, not the production service grants or installed API.

No real market prices, approvals or evidence digests are included in fixtures or delivery evidence.
