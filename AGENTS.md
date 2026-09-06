# Repository Working Agreement

## Route the work first

Main is the Product Lead and may work alone. Classify a task before editing:

- **Lightweight:** bounded maintenance or engineering work using an established decision and contract. Proceed with a compact scope and proportional validation; the product-change template is optional.
- **Meaningful:** changes product behavior, user journey, semantics, visual direction, entitlement, or scope. Work must approve the decisions in `.github/ISSUE_TEMPLATE/product-change.md`, then hand Codex the compact `docs/agents/implementation-packet.md`. The packet—not a discovery transcript—is the Work → Codex trigger.

Specialists are conditional, not gates or a mandatory team. Use the smallest set that resolves concrete uncertainty. Technical checks do not grant product, visual, release, or outcome acceptance; the founder records those human decisions separately.

## Sources of truth

- Stack: Next.js 16.2 App Router, React 19, strict TypeScript, Tailwind CSS 4, Clerk, and server-side access to `finance-backend`.
- Runtime UI truth is `app/globals.css` and rendered components. `design/` is reference only. Preserve the homepage structure, copy, motion, and identity unless homepage work is explicit.
- GitHub is durable implementation and decision truth. Vercel Preview is the frontend human-review surface; deployment ownership is routed by `docs/agents/system-topology.md`.
- Before visual work, study `docs/design/visual-references.md`. Tokens alone are not a brief.

## Before editing

1. Check `git status --short --branch`, task-local instructions, the rendered code, direct dependencies, contracts, states, tests, and nearest pattern.
2. Use `rg --files` and targeted `rg`; ignore generated output. Preserve unrelated changes and avoid opportunistic cleanup.
3. Before changing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`.
4. For backend-dependent work, discover contracts progressively: backend `docs/api-contract.json`, then backend `docs/openapi.json`, owning-repository semantic evidence, local route/helper/types/tests, then frontend `docs/api/` consumption notes and gap records. Frontend documentation is not primary backend contract truth.
5. If support is missing, classify the owning layer using `DATA_SOURCE_POLICY.md` and record an owned gap. Never invent product intent, semantics, endpoints, fields, authentication, or response shapes; do not derive, fan out, substitute, or use a third party without explicit approval. Cross into another repository only when the classified gap or authoritative evidence requires it.

## Canonical commands

- `npm run verify`: lint, strict typecheck, and unit/contract tests.
- `npm run qa:browser`: browser preflight plus Playwright on its owned fixed server.
- `npm run qa:frontend`: verify, production build, and browser QA.

Do not manually run a QA server, choose a port, kill processes, or launch Chromium. Use `PLAYWRIGHT_BASE_URL` only for an intentionally external server. Run checks in proportion to the changed surface.

## Engineering invariants

- Keep pages/layouts server-rendered unless a focused client boundary is needed. Use semantic, accessible React, strict TypeScript, existing primitives, and the current visual language; add no dependency or parallel design system without necessity.
- Design mobile-first through wide desktop. Preserve keyboard, focus, contrast, zoom, touch, and reduced motion. Use CSS for simple transitions, Framer Motion for orchestration, and scoped GSAP scenes only for complex scroll; the root scroll runtime owns the site's single Lenis instance.
- Canvas/3D/force graphs require real data and interaction needs, cleanup, fallback, reduced motion, and browser QA.
- Browser code calls local routes; server helpers call the configured backend. Never expose secrets or call providers directly from the browser.
- Ticker autocomplete loads `/api/tickers/index` once and filters locally; it never calls enrichment, scorecard, per-symbol, or external lookup endpoints while suggesting. Read `DATA_SOURCE_POLICY.md` before changing ticker or stock data.
- Cover applicable loading, empty, malformed, unauthorized, upstream error, timeout, retry, unavailable, partial, and stale states while preserving documented fail-open behavior.

## Validation and completion

For visual/interaction work, follow `docs/qa/viewport-matrix.md` and `docs/qa/browser-qa.md`; inspect console errors, overflow, layout shift, focus order, keyboard, touch, bidirectional scroll, and reduced motion. Report infrastructure blockers exactly rather than improvising.

Keep the diff scoped. Inspect every changed file and the final diff. Unless explicitly asked, do not commit, push, or open a PR. Report exact checks/results, pre-existing failures, deviations, unresolved assumptions, risks, and next steps.
