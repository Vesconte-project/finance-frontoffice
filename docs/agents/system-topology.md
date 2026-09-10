# System Topology and Ownership Router

Use this compact router only when a contract, semantic, deployment, or consumption question crosses a repository boundary. Inspect another repository progressively when its evidence is needed; do not reproduce its internals here.

| Repository | Owns | Does not own | Authoritative contract/runbook | Trigger to cross into it |
| --- | --- | --- | --- | --- |
| `finance-data-ops` | Source acquisition, normalization, source coverage/freshness | Derived semantics, HTTP exposure, UI | Repository source contracts and runbooks | Required source or source evidence is missing |
| `finance-feature-store` | Canonical and derived feature semantics | Raw acquisition, model intent, presentation | Feature definitions, schemas, lineage evidence | A canonical/derived semantic is missing or ambiguous |
| `ml-lab` | Model training/evaluation evidence | Signal product intent or activation | Model/evaluation artifacts and methodology | ML evidence or model behavior must be verified |
| `finance-strategy-lab` | Signal intent, strategy semantics, methodology | Realized simulation or runtime exposure | Strategy specifications and versioned intent | A signal's meaning or intended decision is unresolved |
| `finance-backtest` | Realized simulated validation, benchmarks, costs | Signal intent, model activation | Backtest reports and validation contracts | Realized simulated evidence is required |
| `finance-research-orchestrator` | Experiment execution lineage and reproducibility | Canonical data or production activation | Experiment manifests and lineage records | Experiment provenance/reproduction is unresolved |
| `finance-model-registry` | Eligibility, approval, activation state, model/version identity | Training evidence or serving transport | Registry state and promotion policy | Eligibility or activation truth is required |
| `finance-backend` | HTTP operations, auth, response/error contract | Upstream semantic ownership or frontend state | `docs/api-contract.json`, then `docs/openapi.json` | A verified semantic needs HTTP exposure or HTTP behavior must be checked |
| `finance-infra` | Self-host deployment/runtime composition and operational runbooks | Product semantics, frontend review, analytics meaning | Deployment manifests and operating runbooks | Runtime composition or deployed self-host truth is required |
| `finance-frontoffice` | Frontend consumption, local routes, user-visible state, GitHub/Vercel Preview evidence | Upstream data/semantic invention or self-host deployment | Runtime code/tests, `DATA_SOURCE_POLICY.md`, frontend gap records | A contract is consumed or represented in frontend state |

Cloudflare is the network/access boundary rather than a semantic owner. GitHub is durable implementation/decision truth. GitHub-connected Vercel Preview is the review surface for frontend candidates, not self-host deployment truth.

Missing support must become a gap owned by the matching row. No frontend derivation, third-party lookup, endpoint fan-out, approximate substitution, or “complete” graceful degradation is permitted without an explicit approved decision.
