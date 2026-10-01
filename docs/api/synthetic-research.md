# ENG-147 synthetic research boundary

This proof uses only `synthetic-market-v1`; it makes no financial validation claim.
Backend contract: `app/research_product_api.py` and `app/research_self_service.py`
at finance-backend main `dcec4f8`. The six product operations live under
`/site/research/synthetic`; the browser calls `/api/research/synthetic` instead.
Clerk middleware establishes auth context on these local API routes; route code
resolves the viewer server-side. Incoming identity/secret headers are ignored.

Default: disabled. `RESEARCH_SYNTHETIC_ENABLED=true` opts in only outside Vercel
Production; `RESEARCH_BFF_SECRET` must be present server-side. The existing backend
helper supplies `BACKEND_SHARED_SECRET` and optional Cloudflare Access credentials.
Neither identity nor any credential is accepted from browser JSON. Backend remains
responsible for ownership, closed template compilation, fixture binding and limits.
Its production guard remains a second boundary.

Requests are capped at 4096 UTF-8 bytes during streaming and validated against the
closed declarative contract. Query forwarding allows only one `limit` (1–50) on
the list. Same-origin JSON submission, no redirects, a 30-second abort signal,
no-store upstream fetching and private/no-store replies apply. Public success
responses are projected again; upstream errors/validation input are never echoed.
A POST timeout is an unknown outcome: read recent runs before trying again. There
is no automatic POST retry or claimed idempotency. Backend concurrency checks are
not an atomic reservation; this boundary does not claim to fix that limitation.

Backend artefact routes provide identity/type/hash/date metadata only, not file
contents or download URLs. No local paths, commands, stderr or internal execution
configuration cross this boundary. The optional `audit_summary` from Backend #19 is projected through a closed schema:
summary status/boolean, the two diagnostic types, statuses, nonnegative counts and
at most 100 finding identifiers per diagnostic. Arrays are capped at two diagnostic
records; incomplete, duplicated or malformed evidence never passes. Unknown keys,
raw payloads/messages, paths and commands are discarded. Legacy absence becomes
`not_available`, independent of execution. `validated` refers only to technical
audits; financial validity is never established by these checks.

Backend #18 `public_request` and `comparison_id` remain alongside this summary.
The two additions are independent: runs from either older contract stay readable.

Admission evidence: company-os #119, run 36793650691 attempt 1, trusted code
`f390fb00f35f4575243f293375a7b643fc6f8cbc`; current comment timestamps both
`2026-09-30T23:56:44Z`, verified canonical response digest
`7e95af20c5ebc0f9c6233b44b8931dd8f8fb423c4fa39055c01d3530c77fdf5a`.
Scope source: immutable Product Snapshot
`snap-sha256-e4f00e45abb5cf768ad8c06775a126517056b6239643df2ba876cbc4a03074ec`.

Tests inject the resolved Clerk identity and mock the server-to-server boundary;
they do not create real sessions or exercise an installed worker. Preview proof
must verify actual Clerk hydration, sign-in, cookie forwarding and ownership with
two development identities against the isolated backend. No server access, deploy
or production activation is included.
