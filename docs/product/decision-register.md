# Product and Operating Decision Register

This register contains approved durable decisions only. GitHub is the durable record; implementation packets may reference but not reinterpret these decisions.

## Product decisions

- **Naming:** The product is named **Vesconte**, after the cartographer Pietro Vesconte. The legacy cutover is resolved and closed. `Longbrunch` and `Spy Signal` are retired: they are not aliases and must not appear in copy, metadata, identifiers, storage keys, hostnames, or documentation. Rationale and usage rules live in `docs/brand/naming.md`. Service and ownership identifiers stay decoupled from the brand and use the repository name `finance-frontoffice`; do not create new brand-coupled identifiers.
- **Prioritization user:** a self-directed individual investor monitoring a focused set of assets.
- **Recurring decision:** “Which asset I already care about deserves my attention now, and what evidence changed?”
- **Value ladder:** Anonymous establishes trust; Free establishes the habit; Pro scales a validated habit. Basic is excluded for now.
- **Signals:** Signals stays closed as a core capability until all six trust gates pass:
  1. signal intent and methodology are explicit and versioned;
  2. source data, point-in-time semantics, freshness, and lineage are trustworthy;
  3. canonical/derived features and model evidence are reproducible without leakage;
  4. realized simulated validation includes the approved benchmark, costs, and robustness evidence;
  5. the approved paper/shadow observation requirement passes; and
  6. eligibility, activation, monitoring, rollback, and runtime ownership are approved.
  Exact numerical thresholds and the paper/shadow duration remain unresolved; no implementation may invent them.

## Acceptance and measurement

- The founder is the accountable Product and Visual Approver.
- Technical, product, visual, release, and outcome acceptance are distinct records. CI, tests, screenshots, or a Preview establish evidence but never substitute for human acceptance.
- Operational observability and product analytics are distinct. No product-analytics vendor or final event/measurement definition has been selected. Numeric outcome thresholds and analytics definitions remain unresolved.
- **Usage telemetry:** frontend page, feature, and button usage is emitted as structured JSON to Vercel Runtime Logs, the platform's own operational surface. This is observability plumbing and a provisional event vocabulary in `lib/analytics-events.ts`; it selects no product-analytics vendor and it does not settle measurement definitions or outcome thresholds, which stay unresolved. See `docs/observability/usage-telemetry.md`.

## Durable ownership split

- GitHub owns durable implementation and decision truth.
- GitHub-connected Vercel Preview is the human review surface for frontend candidates; Actions does not deploy it.
- Self-host deployment truth belongs to `finance-infra` and each owning runtime repository.
- Cloudflare is the network/access boundary, not a semantic owner.
- Semantic, HTTP, deployment, and frontend ownership remain separate; use `docs/agents/system-topology.md` to route gaps.
